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

const MAX_DIFF_SUMMARY_FILES = 20;
const LOG_RECORD_SEPARATOR = '\x1e';
const LOG_FIELD_SEPARATOR = '\x1f';

class GitServer {
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
      name: 'git-mcp',
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
      'git_status',
      'Summarise repository status with staged, unstaged, and conflict details.',
      {
        type: 'object',
        properties: {
          include_ignored: {
            type: 'boolean',
            description: 'Include ignored files using git status --ignored.',
            default: false,
          },
          show_stash: {
            type: 'boolean',
            description: 'Include stash information in the status summary.',
            default: false,
          },
          paths: {
            type: 'array',
            description: 'Optional list of pathspecs to limit status inspection.',
            items: { type: 'string' },
          },
          working_directory: {
            type: 'string',
            description:
              'Directory to run git status in (defaults to the server launch directory).',
          },
        },
        additionalProperties: false,
      },
      (args) => this.handleStatus(args)
    );

    this.registerTool(
      'git_diff',
      'Inspect diffs for revisions, staged changes, or specific paths with aggregated summaries.',
      {
        type: 'object',
        properties: {
          revision_range: {
            type: 'string',
            description: 'Revision range or commit-ish to compare (e.g. HEAD~2..HEAD).',
          },
          staged: {
            type: 'boolean',
            description: 'Use the staged index (git diff --cached).',
            default: false,
          },
          include_stat: {
            type: 'boolean',
            description: 'Include diffstat summary.',
            default: true,
          },
          include_patch: {
            type: 'boolean',
            description: 'Include patch details; disable for stat-only summaries.',
            default: true,
          },
          context: {
            type: 'integer',
            description: 'Number of context lines to show around changes.',
            minimum: 0,
            maximum: 200,
          },
          ignore_whitespace: {
            type: 'string',
            description: 'Whitespace handling (`none`, `space-change`, `all`, `blank-lines`, `eol`).',
            enum: ['none', 'space-change', 'all', 'blank-lines', 'eol'],
            default: 'none',
          },
          word_diff: {
            type: 'string',
            description: 'Enable word diff highlighting (`none`, `plain`, `porcelain`).',
            enum: ['none', 'plain', 'porcelain'],
            default: 'none',
          },
          paths: {
            type: 'array',
            description: 'Limit the diff to these pathspecs.',
            items: { type: 'string' },
          },
          working_directory: {
            type: 'string',
            description:
              'Directory to run git diff in (defaults to the server launch directory).',
          },
        },
        additionalProperties: false,
      },
      (args) => this.handleDiff(args)
    );

    this.registerTool(
      'git_log',
      'Display recent commits as a structured timeline.',
      {
        type: 'object',
        properties: {
          revision: {
            type: 'string',
            description: 'Starting revision (defaults to HEAD).',
          },
          max_entries: {
            type: 'integer',
            description: 'Maximum number of commits to retrieve.',
            minimum: 1,
            maximum: 250,
            default: 20,
          },
          author: {
            type: 'string',
            description: 'Filter commits by author (uses git log --author).',
          },
          grep: {
            type: 'string',
            description: 'Filter commit messages using git log --grep.',
          },
          since: {
            type: 'string',
            description: 'Only show commits more recent than this date.',
          },
          until: {
            type: 'string',
            description: 'Only show commits older than this date.',
          },
          merge_filter: {
            type: 'string',
            description: 'Filter merge commits (`any`, `only-merges`, `no-merges`).',
            enum: ['any', 'only-merges', 'no-merges'],
            default: 'any',
          },
          paths: {
            type: 'array',
            description: 'Limit the history to specific paths.',
            items: { type: 'string' },
          },
          working_directory: {
            type: 'string',
            description:
              'Directory to run git log in (defaults to the server launch directory).',
          },
        },
        additionalProperties: false,
      },
      (args) => this.handleLog(args)
    );

    this.registerTool(
      'git_branch_overview',
      'Summarise branches with upstream tracking and recent activity indicators.',
      {
        type: 'object',
        properties: {
          scope: {
            type: 'string',
            description: 'Branch scope to inspect (`local`, `remote`, or `all`).',
            enum: ['local', 'remote', 'all'],
            default: 'local',
          },
          merge_filter: {
            type: 'string',
            description: 'Filter by merge status (`any`, `merged`, `no-merged`).',
            enum: ['any', 'merged', 'no-merged'],
            default: 'any',
          },
          contains: {
            type: 'string',
            description: 'Limit to branches containing the specified revision.',
          },
          sort_by: {
            type: 'string',
            description: 'Sorting strategy (`recency`, `name`, or `ahead-behind`).',
            enum: ['recency', 'name', 'ahead-behind'],
            default: 'recency',
          },
          working_directory: {
            type: 'string',
            description:
              'Directory to run git branch in (defaults to the server launch directory).',
          },
        },
        additionalProperties: false,
      },
      (args) => this.handleBranchOverview(args)
    );

    this.registerTool(
      'git_show',
      'Inspect a commit, tag, or other Git object without mutating state.',
      {
        type: 'object',
        properties: {
          git_object: {
            type: 'string',
            description: 'Git object to display (commit, tag, tree, blob).',
          },
          include_patch: {
            type: 'boolean',
            description: 'Include patch output (default true for commits).',
            default: true,
          },
          include_stat: {
            type: 'boolean',
            description: 'Include diffstat summary.',
            default: false,
          },
          pretty: {
            type: 'string',
            description: 'Pretty-print style (`medium`, `full`, `fuller`, `raw`, `oneline`).',
            enum: ['medium', 'full', 'fuller', 'raw', 'oneline'],
          },
          paths: {
            type: 'array',
            description: 'Restrict output to these pathspecs.',
            items: { type: 'string' },
          },
          working_directory: {
            type: 'string',
            description:
              'Directory to run git show in (defaults to the server launch directory).',
          },
        },
        required: ['git_object'],
        additionalProperties: false,
      },
      (args) => this.handleShow(args)
    );

    this.registerTool(
      'git_blame_segment',
      'Inspect ownership details for a file range using git blame.',
      {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            description: 'Path to the file to annotate.',
          },
          start_line: {
            type: 'integer',
            description: 'Starting line number (1-based).',
            minimum: 1,
          },
          end_line: {
            type: 'integer',
            description: 'Ending line number (inclusive).',
            minimum: 1,
          },
          revision: {
            type: 'string',
            description: 'Optional revision (defaults to HEAD).',
          },
          working_directory: {
            type: 'string',
            description:
              'Directory to run git blame in (defaults to the server launch directory).',
          },
        },
        required: ['file'],
        additionalProperties: false,
      },
      (args) => this.handleBlame(args)
    );

    this.registerTool(
      'git_list_conflicts',
      'Summarise files with merge conflicts using git ls-files -u.',
      {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            description: 'Optional pathspecs to limit the conflict report.',
            items: { type: 'string' },
          },
          working_directory: {
            type: 'string',
            description:
              'Directory to inspect for conflicts (defaults to the server launch directory).',
          },
        },
        additionalProperties: false,
      },
      (args) => this.handleConflicts(args)
    );

    this.registerTool(
      'git_last_response',
      'Inspect or search the most recent git command response captured by this server.',
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

  private registerTool(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: ToolHandler
  ): void {
    this.tools.push({ name, description, inputSchema });
    this.toolHandlers.set(name, handler);
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

  private setupProcessHandlers(): void {
    this.server.onerror = (error) => {
      console.error('[git-mcp] Server error', error);
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
    console.error('git-mcp server listening on stdio');
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

  private async runGitCommand(args: string[], workingDirectory?: string): Promise<CommandResult> {
    const cwd = await this.resolveWorkingDirectory(workingDirectory);
    const start = Date.now();

    return await new Promise<CommandResult>((resolve, reject) => {
      const child = spawn('git', args, {
        cwd,
        env: { ...process.env, LC_ALL: 'C', LANG: 'C' },
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

  private buildResponse(
    commandArgs: string[],
    result: CommandResult,
    overrides?: { stdout?: string; stderr?: string }
  ) {
    const commandArgsCopy = [...commandArgs];
    const displayResult: CommandResult = {
      ...result,
      stdout: overrides?.stdout ?? result.stdout,
      stderr: overrides?.stderr ?? result.stderr,
    };

    const { previewText, detailedText, isError } = this.formatResult(commandArgsCopy, displayResult);

    this.lastResult = {
      commandArgs: commandArgsCopy,
      formattedText: detailedText,
      raw: displayResult,
      capturedAt: new Date().toISOString(),
    };

    return {
      content: [{ type: 'text', text: previewText }],
      isError,
    };
  }

  private formatResult(commandArgs: string[], result: CommandResult): {
    previewText: string;
    detailedText: string;
    isError: boolean;
  } {
    const exitCodeDisplay = result.exitCode ?? 'null';
    const isSuccess = result.exitCode === 0;

    const headerLines = [
      `Command: git ${commandArgs.join(' ')}`,
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
      ? 'Preview truncated. Run git_last_response to inspect the complete command output.'
      : 'Full output stored. Run git_last_response to inspect the complete command output.';

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
      throw new Error(`Expected ${fieldName} to be a string.`);
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }

  private ensureBoolean(value: unknown, fieldName: string): boolean | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'boolean') {
      throw new Error(`Expected ${fieldName} to be a boolean.`);
    }
    return value;
  }

  private ensureInteger(
    value: unknown,
    fieldName: string,
    options?: { min?: number; max?: number }
  ): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new Error(`Expected ${fieldName} to be an integer.`);
    }
    if (options?.min !== undefined && value < options.min) {
      throw new Error(`Expected ${fieldName} to be >= ${options.min}.`);
    }
    if (options?.max !== undefined && value > options.max) {
      throw new Error(`Expected ${fieldName} to be <= ${options.max}.`);
    }
    return value;
  }

  private ensureStringArray(value: unknown, fieldName: string): string[] | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (!Array.isArray(value)) {
      throw new Error(`Expected ${fieldName} to be an array of strings.`);
    }
    const result: string[] = [];
    for (const entry of value) {
      if (typeof entry !== 'string') {
        throw new Error(`Expected ${fieldName} to be an array of strings.`);
      }
      const trimmed = entry.trim();
      if (trimmed.length > 0) {
        result.push(trimmed);
      }
    }
    return result.length === 0 ? undefined : result;
  }

  private ensureEnum<T extends readonly string[]>(
    value: unknown,
    fieldName: string,
    allowed: T
  ): T[number] | undefined {
    const str = this.ensureString(value, fieldName);
    if (str === undefined) {
      return undefined;
    }
    if (!(allowed as readonly string[]).includes(str)) {
      throw new Error(
        `Invalid value for ${fieldName}. Expected one of: ${(allowed as readonly string[]).join(', ')}.`
      );
    }
    return str as T[number];
  }

  private async handleStatus(rawArgs: Record<string, unknown>) {
    const includeIgnored = this.ensureBoolean(rawArgs.include_ignored, 'include_ignored') ?? false;
    const showStash = this.ensureBoolean(rawArgs.show_stash, 'show_stash') ?? false;
    const paths = this.ensureStringArray(rawArgs.paths, 'paths');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    const args: string[] = ['status', '--porcelain=2', '--branch', '--no-renames', '--no-color'];
    if (includeIgnored) {
      args.push('--ignored');
    }
    if (showStash) {
      args.push('--show-stash');
    }
    if (paths && paths.length > 0) {
      args.push('--', ...paths);
    }

    const result = await this.runGitCommand(args, workingDirectory);
    const summary = this.renderStatusSummary(result.stdout);
    const displayStdout =
      summary !== null
        ? `${summary}\n\n--- git status (porcelain v2) ---\n${result.stdout.trimEnd() || '(no status output)'}`
        : 'Working tree appears clean.';

    return this.buildResponse(args, result, { stdout: displayStdout });
  }

  private async handleDiff(rawArgs: Record<string, unknown>) {
    const revisionRange = this.ensureString(rawArgs.revision_range, 'revision_range');
    const staged = this.ensureBoolean(rawArgs.staged, 'staged') ?? false;
    const includeStat = this.ensureBoolean(rawArgs.include_stat, 'include_stat') ?? true;
    const includePatch = this.ensureBoolean(rawArgs.include_patch, 'include_patch') ?? true;
    const context = this.ensureInteger(rawArgs.context, 'context', { min: 0, max: 200 });
    const ignoreWhitespace = this.ensureEnum(
      rawArgs.ignore_whitespace,
      'ignore_whitespace',
      ['none', 'space-change', 'all', 'blank-lines', 'eol'] as const
    ) ?? 'none';
    const wordDiffMode =
      this.ensureEnum(rawArgs.word_diff, 'word_diff', ['none', 'plain', 'porcelain'] as const) ?? 'none';
    const paths = this.ensureStringArray(rawArgs.paths, 'paths');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    const baseArgs: string[] = ['diff', '--no-color'];
    if (staged) {
      baseArgs.push('--cached');
    }
    if (context !== undefined) {
      baseArgs.push(`-U${context}`);
    }
    switch (ignoreWhitespace) {
      case 'space-change':
        baseArgs.push('--ignore-space-change');
        break;
      case 'all':
        baseArgs.push('--ignore-all-space');
        break;
      case 'blank-lines':
        baseArgs.push('--ignore-blank-lines');
        break;
      case 'eol':
        baseArgs.push('--ignore-cr-at-eol');
        break;
      default:
        break;
    }
    if (wordDiffMode === 'plain') {
      baseArgs.push('--word-diff');
    } else if (wordDiffMode === 'porcelain') {
      baseArgs.push('--word-diff=porcelain');
    }
    if (revisionRange) {
      baseArgs.push(revisionRange);
    }

    const pathArgs = paths && paths.length > 0 ? ['--', ...paths] : [];
    const mainArgs = [...baseArgs];
    if (includeStat && includePatch) {
      mainArgs.push('--stat', '--patch');
    } else if (includeStat && !includePatch) {
      mainArgs.push('--stat');
    } else if (!includeStat && !includePatch) {
      mainArgs.push('--no-patch');
    }

    const summaryArgs = includeStat || includePatch ? [...baseArgs, '--numstat', ...pathArgs] : null;
    const displaySections: string[] = [];
    if (summaryArgs) {
      const statsResult = await this.runGitCommand(summaryArgs, workingDirectory);
      const summary = this.renderDiffSummary(statsResult.stdout);
      if (summary) {
        displaySections.push(summary);
      }
    }

    const finalArgs = [...mainArgs, ...pathArgs];
    const result = await this.runGitCommand(finalArgs, workingDirectory);
    const body = result.stdout.trimEnd();
    if (body.length > 0) {
      displaySections.push(body);
    } else if (displaySections.length === 0) {
      displaySections.push('No differences detected.');
    }

    const displayStdout = displaySections.join('\n\n---\n\n');
    return this.buildResponse(finalArgs, result, { stdout: displayStdout });
  }

  private async handleLog(rawArgs: Record<string, unknown>) {
    const revision = this.ensureString(rawArgs.revision, 'revision');
    const maxEntries =
      this.ensureInteger(rawArgs.max_entries, 'max_entries', { min: 1, max: 250 }) ?? 20;
    const author = this.ensureString(rawArgs.author, 'author');
    const grep = this.ensureString(rawArgs.grep, 'grep');
    const since = this.ensureString(rawArgs.since, 'since');
    const until = this.ensureString(rawArgs.until, 'until');
    const mergeFilter =
      this.ensureEnum(rawArgs.merge_filter, 'merge_filter', ['any', 'only-merges', 'no-merges'] as const) ??
      'any';
    const paths = this.ensureStringArray(rawArgs.paths, 'paths');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    const format =
      '%H' +
      LOG_FIELD_SEPARATOR +
      '%an' +
      LOG_FIELD_SEPARATOR +
      '%ar' +
      LOG_FIELD_SEPARATOR +
      '%s' +
      LOG_FIELD_SEPARATOR +
      '%d' +
      LOG_RECORD_SEPARATOR;

    const args: string[] = ['log', '--no-color', `--pretty=format:${format}`];
    if (revision) {
      args.push(revision);
    }
    if (maxEntries) {
      args.push('-n', String(maxEntries));
    }
    if (author) {
      args.push(`--author=${author}`);
    }
    if (grep) {
      args.push(`--grep=${grep}`);
    }
    if (since) {
      args.push(`--since=${since}`);
    }
    if (until) {
      args.push(`--until=${until}`);
    }
    if (mergeFilter === 'only-merges') {
      args.push('--merges');
    } else if (mergeFilter === 'no-merges') {
      args.push('--no-merges');
    }
    if (paths && paths.length > 0) {
      args.push('--', ...paths);
    }

    const result = await this.runGitCommand(args, workingDirectory);
    const summary = this.renderLogSummary(result.stdout, maxEntries);
    const displayStdout = summary ?? 'No commits match the provided filters.';
    return this.buildResponse(args, result, { stdout: displayStdout });
  }

  private async handleBranchOverview(rawArgs: Record<string, unknown>) {
    const scope = this.ensureEnum(rawArgs.scope, 'scope', ['local', 'remote', 'all'] as const) ?? 'local';
    const mergeFilter =
      this.ensureEnum(rawArgs.merge_filter, 'merge_filter', ['any', 'merged', 'no-merged'] as const) ??
      'any';
    const contains = this.ensureString(rawArgs.contains, 'contains');
    const sortBy =
      this.ensureEnum(rawArgs.sort_by, 'sort_by', ['recency', 'name', 'ahead-behind'] as const) ??
      'recency';
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    const format =
      '%(HEAD)\t%(refname:short)\t%(objectname:short)\t%(committerdate:relative)\t%(upstream:short)\t%(ahead)\t%(behind)\t%(authorname)\t%(subject)';
    const args: string[] = ['branch', '--no-color', `--format=${format}`];
    if (scope === 'all') {
      args.push('--all');
    } else if (scope === 'remote') {
      args.push('--remotes');
    }
    if (mergeFilter === 'merged') {
      args.push('--merged');
    } else if (mergeFilter === 'no-merged') {
      args.push('--no-merged');
    }
    if (contains) {
      args.push(`--contains=${contains}`);
    }

    const sortMapping: Record<string, string> = {
      recency: '-committerdate',
      name: 'refname',
      'ahead-behind': '-ahead',
    };
    args.push(`--sort=${sortMapping[sortBy]}`);

    const result = await this.runGitCommand(args, workingDirectory);
    const summary = this.renderBranchSummary(result.stdout, scope);
    const displayStdout = summary ?? 'No branches match the requested filters.';

    return this.buildResponse(args, result, { stdout: displayStdout });
  }

  private async handleShow(rawArgs: Record<string, unknown>) {
    const gitObject = this.ensureString(rawArgs.git_object, 'git_object');
    if (!gitObject) {
      throw new Error('git_object is required.');
    }
    const includePatch = this.ensureBoolean(rawArgs.include_patch, 'include_patch') ?? true;
    const includeStat = this.ensureBoolean(rawArgs.include_stat, 'include_stat') ?? false;
    const pretty = this.ensureEnum(
      rawArgs.pretty,
      'pretty',
      ['medium', 'full', 'fuller', 'raw', 'oneline'] as const
    );
    const paths = this.ensureStringArray(rawArgs.paths, 'paths');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    const args: string[] = ['show', '--no-color'];
    if (includeStat) {
      args.push('--stat');
    }
    if (!includePatch) {
      args.push('--no-patch');
    }
    if (pretty) {
      args.push(`--pretty=${pretty}`);
    }
    args.push(gitObject);
    if (paths && paths.length > 0) {
      args.push('--', ...paths);
    }

    const result = await this.runGitCommand(args, workingDirectory);
    return this.buildResponse(args, result);
  }

  private async handleBlame(rawArgs: Record<string, unknown>) {
    const file = this.ensureString(rawArgs.file, 'file');
    if (!file) {
      throw new Error('file is required.');
    }
    const startLine = this.ensureInteger(rawArgs.start_line, 'start_line', { min: 1 });
    const endLine = this.ensureInteger(rawArgs.end_line, 'end_line', { min: 1 });
    if (startLine !== undefined && endLine !== undefined && endLine < startLine) {
      throw new Error('end_line must be greater than or equal to start_line.');
    }
    const revision = this.ensureString(rawArgs.revision, 'revision');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    const args: string[] = ['blame', '--line-porcelain', '--date=iso'];
    if (revision) {
      args.push(revision);
    } else {
      args.push('HEAD');
    }
    if (startLine !== undefined || endLine !== undefined) {
      const finalEnd = endLine ?? startLine;
      args.push('-L', `${startLine ?? 1},${finalEnd}`);
    }
    args.push('--', file);

    const result = await this.runGitCommand(args, workingDirectory);
    const summary = this.renderBlameSummary(result.stdout, file);
    const displayStdout = summary ?? 'No blame information available for the specified range.';

    return this.buildResponse(args, result, { stdout: displayStdout });
  }

  private async handleConflicts(rawArgs: Record<string, unknown>) {
    const paths = this.ensureStringArray(rawArgs.paths, 'paths');
    const workingDirectory = this.ensureString(rawArgs.working_directory, 'working_directory');

    const args: string[] = ['ls-files', '-u'];
    if (paths && paths.length > 0) {
      args.push('--', ...paths);
    }

    const result = await this.runGitCommand(args, workingDirectory);
    const summary = this.renderConflictSummary(result.stdout);
    const displayStdout = summary ?? 'No merge conflicts detected in the working tree.';

    return this.buildResponse(args, result, { stdout: displayStdout });
  }

  private async handleLastResponse(rawArgs: Record<string, unknown>) {
    if (!this.lastResult) {
      return {
        content: [
          {
            type: 'text',
            text: 'No git commands have been run yet in this session.',
          },
        ],
      };
    }

    const query = this.ensureString(rawArgs.query, 'query');
    const caseSensitive = this.ensureBoolean(rawArgs.case_sensitive, 'case_sensitive') ?? false;
    const maxMatches = this.ensureInteger(rawArgs.max_matches, 'max_matches', { min: 1 });
    const lineNumbers = this.ensureBoolean(rawArgs.line_numbers, 'line_numbers') ?? false;

    const baseText = this.lastResult.formattedText;
    let bodyText: string;
    const extraLines: string[] = [];

    if (query) {
      const haystack = caseSensitive ? baseText : baseText.toLowerCase();
      const needle = caseSensitive ? query : query.toLowerCase();
      const lines = baseText.split('\n');
      const matches: string[] = [];
      let totalMatches = 0;

      for (let index = 0; index < lines.length; index += 1) {
        const candidate = caseSensitive ? lines[index] : lines[index].toLowerCase();
        if (candidate.includes(needle)) {
          totalMatches += 1;
          if (!maxMatches || matches.length < maxMatches) {
            const prefix = lineNumbers ? `${index + 1}: ` : '';
            matches.push(`${prefix}${lines[index]}`);
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
        if (!maxMatches || totalMatches > matches.length) {
          extraLines.push(`Total matches found: ${totalMatches}`);
        }
      }
    } else {
      bodyText = baseText;
    }

    const { content, displayedTokens, totalTokens } = this.truncateStream(bodyText, false);

    const headerLines = [
      `Most recent command: git ${this.lastResult.commandArgs.join(' ')}`,
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

  private renderStatusSummary(raw: string): string | null {
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return null;
    }

    const branchInfo: {
      head?: string;
      upstream?: string;
      ahead?: number;
      behind?: number;
      stash?: string[];
    } = {};
    const staged: Array<{ path: string; status: string }> = [];
    const unstaged: Array<{ path: string; status: string }> = [];
    const untracked: string[] = [];
    const ignored: string[] = [];
    const conflicts: Array<{ path: string; status: string }> = [];

    for (const line of lines) {
      if (line.startsWith('#')) {
        const [, key, ...rest] = line.split(' ');
        const value = rest.join(' ').trim();
        switch (key) {
          case 'branch.head':
            branchInfo.head = value || '(detached HEAD)';
            break;
          case 'branch.upstream':
            branchInfo.upstream = value || undefined;
            break;
          case 'branch.ab': {
            const match = value.match(/\+(\d+)\s+-(\d+)/);
            if (match) {
              branchInfo.ahead = Number.parseInt(match[1], 10);
              branchInfo.behind = Number.parseInt(match[2], 10);
            }
            break;
          }
          case 'stash': {
            branchInfo.stash ??= [];
            branchInfo.stash.push(value);
            break;
          }
          default:
            break;
        }
        continue;
      }

      if (line.startsWith('? ')) {
        const path = line.slice(2).trim();
        if (path) {
          untracked.push(path);
        }
        continue;
      }

      if (line.startsWith('! ')) {
        const path = line.slice(2).trim();
        if (path) {
          ignored.push(path);
        }
        continue;
      }

      if (line.startsWith('1 ') || line.startsWith('2 ') || line.startsWith('u ')) {
        const [meta, ...rest] = line.split('\t');
        const metaParts = meta.split(' ');
        const recordType = metaParts[0];
        const xy = metaParts[1] ?? '..';
        const indexStatus = xy[0] ?? '.';
        const worktreeStatus = xy[1] ?? '.';
        const path = rest[0] ?? '';
        const originalPath = rest[1];

        if (recordType === 'u') {
          conflicts.push({
            path,
            status: this.describeStatusCode(indexStatus, originalPath),
          });
          continue;
        }

        if (indexStatus !== '.') {
          staged.push({
            path: originalPath ? `${originalPath} -> ${path}` : path,
            status: this.describeStatusCode(indexStatus, originalPath),
          });
        }

        if (worktreeStatus !== '.') {
          const status = this.describeStatusCode(worktreeStatus, originalPath);
          if (worktreeStatus === 'U' || indexStatus === 'U') {
            conflicts.push({ path, status });
          } else {
            unstaged.push({ path, status });
          }
        }
        continue;
      }
    }

    const summaryLines: string[] = [];
    summaryLines.push('Status summary:');
    summaryLines.push(
      `  - HEAD: ${branchInfo.head ?? '(not reported)'}` +
        (branchInfo.upstream
          ? ` tracking ${branchInfo.upstream}` +
            ` (ahead ${branchInfo.ahead ?? 0}, behind ${branchInfo.behind ?? 0})`
          : '')
    );
    if (branchInfo.stash && branchInfo.stash.length > 0) {
      summaryLines.push(`  - Stash entries: ${branchInfo.stash.length}`);
    }

    const renderSection = (
      title: string,
      entries: Array<{ path: string; status: string }>,
      fallback: string
    ) => {
      summaryLines.push(`${title}:`);
      if (entries.length === 0) {
        summaryLines.push(`    ${fallback}`);
      } else {
        for (const entry of entries.slice(0, 40)) {
          summaryLines.push(`    - ${entry.path} [${entry.status}]`);
        }
        if (entries.length > 40) {
          summaryLines.push(`    ... ${entries.length - 40} more`);
        }
      }
    };

    renderSection('  Staged changes', staged, 'None');
    renderSection('  Unstaged changes', unstaged, 'None');

    summaryLines.push('  Untracked files:');
    if (untracked.length === 0) {
      summaryLines.push('    None');
    } else {
      for (const pathItem of untracked.slice(0, 40)) {
        summaryLines.push(`    - ${pathItem}`);
      }
      if (untracked.length > 40) {
        summaryLines.push(`    ... ${untracked.length - 40} more`);
      }
    }

    summaryLines.push('  Ignored files:');
    if (ignored.length === 0) {
      summaryLines.push('    None');
    } else {
      for (const pathItem of ignored.slice(0, 40)) {
        summaryLines.push(`    - ${pathItem}`);
      }
      if (ignored.length > 40) {
        summaryLines.push(`    ... ${ignored.length - 40} more`);
      }
    }

    summaryLines.push('  Merge conflicts:');
    if (conflicts.length === 0) {
      summaryLines.push('    None');
    } else {
      for (const entry of conflicts.slice(0, 40)) {
        summaryLines.push(`    - ${entry.path} [${entry.status}]`);
      }
      if (conflicts.length > 40) {
        summaryLines.push(`    ... ${conflicts.length - 40} more`);
      }
    }

    return summaryLines.join('\n');
  }

  private describeStatusCode(code: string, originalPath?: string): string {
    switch (code) {
      case 'M':
        return 'Modified';
      case 'A':
        return 'Added';
      case 'D':
        return 'Deleted';
      case 'R':
        return originalPath ? `Renamed from ${originalPath}` : 'Renamed';
      case 'C':
        return 'Copied';
      case 'T':
        return 'Type change';
      case 'U':
        return 'Updated (unmerged)';
      default:
        return 'Changed';
    }
  }

  private renderDiffSummary(raw: string): string | null {
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return null;
    }

    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;
    const perFileLines: string[] = [];

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 3) {
        continue;
      }
      const added = parts[0] === '-' ? 0 : Number.parseInt(parts[0], 10) || 0;
      const removed = parts[1] === '-' ? 0 : Number.parseInt(parts[1], 10) || 0;
      const filePath = parts[2];
      filesChanged += 1;
      insertions += added;
      deletions += removed;
      if (perFileLines.length < MAX_DIFF_SUMMARY_FILES) {
        perFileLines.push(`  - ${filePath}: +${added} / -${removed}`);
      }
    }

    if (filesChanged === 0) {
      return null;
    }

    const summaryLines = [
      'Diff summary:',
      `  Files changed: ${filesChanged}`,
      `  Insertions: ${insertions}`,
      `  Deletions: ${deletions}`,
    ];

    if (perFileLines.length > 0) {
      summaryLines.push('  Per-file breakdown:');
      summaryLines.push(...perFileLines);
      if (filesChanged > MAX_DIFF_SUMMARY_FILES) {
        summaryLines.push(`  ... ${filesChanged - MAX_DIFF_SUMMARY_FILES} more`);
      }
    }

    return summaryLines.join('\n');
  }

  private renderLogSummary(raw: string, maxEntries: number): string | null {
    const records = raw.split(LOG_RECORD_SEPARATOR).filter((record) => record.trim().length > 0);
    if (records.length === 0) {
      return null;
    }

    const lines: string[] = [];
    lines.push(`Recent commits (showing up to ${maxEntries}):`);

    let index = 1;
    for (const record of records) {
      const [hash, author, relativeTime, subject, decoration] = record.split(LOG_FIELD_SEPARATOR);
      const shortHash = hash ? hash.slice(0, 12) : '(unknown)';
      const refs = decoration?.trim().replace(/^\(|\)$/g, '');
      lines.push(
        `${index}. ${shortHash} | ${relativeTime ?? 'unknown time'} | ${author ?? 'unknown author'}`
      );
      lines.push(`    ${subject ?? '(no subject)'}`);
      if (refs) {
        lines.push(`    refs: ${refs}`);
      }
      index += 1;
    }

    return lines.join('\n');
  }

  private renderBranchSummary(raw: string, scope: string): string | null {
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return null;
    }

    const summaryLines: string[] = [];
    summaryLines.push(`Branch overview (${scope}):`);

    for (const line of lines) {
      const [headMarker, name, hash, relativeDate, upstream, ahead, behind, author, subject] =
        line.split('\t');
      const marker = headMarker === '*' ? '*' : ' ';
      const tracking =
        upstream && upstream.trim().length > 0
          ? `tracking ${upstream.trim()} (ahead ${ahead || 0}, behind ${behind || 0})`
          : 'no upstream';
      summaryLines.push(
        `${marker} ${name ?? '(unknown)'} | ${hash ?? '????????'} | ${relativeDate ?? 'unknown recency'}`
      );
      summaryLines.push(`    ${tracking} | last author: ${author || 'unknown'}`);
      if (subject && subject.trim().length > 0) {
        summaryLines.push(`    last commit: ${subject.trim()}`);
      }
    }

    return summaryLines.join('\n');
  }

  private renderBlameSummary(raw: string, file: string): string | null {
    const lines = raw.split('\n');
    if (lines.length === 0 || (lines.length === 1 && lines[0].trim().length === 0)) {
      return null;
    }

    type BlameEntry = {
      finalLine: number;
      commit: string;
      author: string;
      authorTime?: string;
      summary?: string;
      content: string;
    };
    const entries: BlameEntry[] = [];

    let index = 0;
    while (index < lines.length) {
      const header = lines[index];
      if (!header) {
        index += 1;
        continue;
      }
      const headerParts = header.split(' ');
      const commit = headerParts[0];
      const finalLine = Number.parseInt(headerParts[2] ?? '0', 10);
      index += 1;
      const entry: BlameEntry = {
        finalLine: Number.isFinite(finalLine) ? finalLine : 0,
        commit,
        author: 'unknown',
        content: '',
      };

      while (index < lines.length && !lines[index].startsWith('\t')) {
        const metaLine = lines[index];
        if (metaLine.startsWith('author ')) {
          entry.author = metaLine.slice(7).trim() || 'unknown';
        } else if (metaLine.startsWith('author-time ')) {
          const epoch = Number.parseInt(metaLine.slice(12).trim(), 10);
          if (Number.isFinite(epoch)) {
            entry.authorTime = new Date(epoch * 1000).toISOString();
          }
        } else if (metaLine.startsWith('summary ')) {
          entry.summary = metaLine.slice(8).trim();
        }
        index += 1;
      }

      if (index < lines.length && lines[index].startsWith('\t')) {
        entry.content = lines[index].slice(1);
        index += 1;
      }

      entries.push(entry);
    }

    if (entries.length === 0) {
      return null;
    }

    const summaryLines: string[] = [];
    summaryLines.push(`Blame summary for ${file}:`);
    for (const entry of entries) {
      const shortCommit = entry.commit.slice(0, 12);
      const timestamp = entry.authorTime ?? 'unknown time';
      summaryLines.push(
        `  ${entry.finalLine.toString().padStart(4, ' ')} | ${shortCommit} | ${
          entry.author
        } | ${timestamp}`
      );
      summaryLines.push(`       ${entry.content}`);
      if (entry.summary && entry.summary.trim().length > 0) {
        summaryLines.push(`       summary: ${entry.summary.trim()}`);
      }
    }

    return summaryLines.join('\n');
  }

  private renderConflictSummary(raw: string): string | null {
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return null;
    }

    type ConflictRecord = {
      stages: Set<number>;
      hashes: Set<string>;
    };
    const conflicts = new Map<string, ConflictRecord>();

    for (const line of lines) {
      const [meta, pathPart] = line.split('\t');
      if (!meta || !pathPart) {
        continue;
      }
      const metaParts = meta.trim().split(/\s+/);
      const hash = metaParts[1] ?? '';
      const stage = Number.parseInt(metaParts[2] ?? '0', 10);
      const record = conflicts.get(pathPart) ?? { stages: new Set(), hashes: new Set() };
      if (Number.isFinite(stage)) {
        record.stages.add(stage);
      }
      if (hash) {
        record.hashes.add(hash);
      }
      conflicts.set(pathPart, record);
    }

    if (conflicts.size === 0) {
      return null;
    }

    const summaryLines: string[] = [];
    summaryLines.push(`Merge conflicts detected: ${conflicts.size} file(s)`);

    for (const [filePath, record] of conflicts) {
      const stageNames = [...record.stages]
        .sort()
        .map((stage) => {
          switch (stage) {
            case 1:
              return 'base';
            case 2:
              return 'ours';
            case 3:
              return 'theirs';
            default:
              return `stage ${stage}`;
          }
        })
        .join(', ');
      summaryLines.push(`  - ${filePath} (stages: ${stageNames})`);
    }

    return summaryLines.join('\n');
  }
}

const server = new GitServer();
server.run().catch((error) => {
  console.error('Failed to start git-mcp server:', error);
  process.exit(1);
});
