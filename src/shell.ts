import { spawnSync, SpawnSyncReturns } from "node:child_process";
import { logger } from './logger.js';
import { platform } from 'os';
import { parse } from 'shell-quote';

/**
 * Cross-platform shell executor
 * - Windows: PowerShell Core (pwsh) or Windows PowerShell (powershell)
 * - macOS/Linux: bash or zsh
 */
export class Shell {
  private static readonly instances = new Map<string, Shell>();

  private constructor() {
    logger.debug(`Initializing Shell, platform: ${platform()} process.cwd: ${process.cwd()}`);
  }

  static instance(): Shell {
    const pwd = process.cwd();
    if (Shell.instances.get(pwd)) {
      return Shell.instances.get(pwd)!;
    }
    const shell = new Shell();
    Shell.instances.set(pwd, shell);
    return shell;
  }
  /**
   * Execute a shell command and return stdout as string
   * @param command The command to execute
   */
  run(shell_command: string, ...args: string[]): string {
    logger.debug(`Executing shell command: \n----\n${shell_command}${args.length > 0 ? ` ${args.join(" ")}` : ""}\n----`);
    const startTime = Date.now();
    try {
      let command: string;
      let commandArgs: string[];

      if (args.length > 0) {
        // Prefer explicit (executable, ...args)
        command = shell_command;
        commandArgs = args;
      } else {
        // Safely split the shell_command string into command and args
        const parsed = parse(shell_command).filter((x: any) => typeof x === "string") as string[];
        if (parsed.length === 0) {
          throw new Error("No command to execute.");
        }
        command = parsed[0];
        commandArgs = parsed.slice(1);
      }

      // Always use shell: false to avoid command injection
      const result: SpawnSyncReturns<string> = spawnSync(
        command,
        commandArgs,
        {
          encoding: "utf-8", shell: false, cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 10,
        }
      );

      const duration = Date.now() - startTime;
      if (result.error) {
        logger.error(`Command failed (${duration}ms): ${shell_command}${args.length > 0 ? ` ${args.join(" ")}` : ""}`, result.error);
        return result.error.message;
      }
      const output = result.stdout.replace(/[\r\n]+/g, "\n").trimEnd() || result.stderr.replace(/[\r\n]+/g, "\n").trimEnd();
      logger.debug(`Command output: \n----\n${output}\n----`);
      logger.debug(`Command completed (${duration}ms) ${JSON.stringify({
        command: shell_command + (args.length > 0 ? ` ${args.join(" ")}` : ""),
        output,
        outputLength: output.length,
        exitCode: result.status
      })}`);
      return output;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Shell execution failed after ${duration}ms`, error);
      return error instanceof Error ? error.message : String(error);
    }
  }

  runProcess(process: string, ...args: string[]): string {
    return this.run(process, ...args);
  }
}
