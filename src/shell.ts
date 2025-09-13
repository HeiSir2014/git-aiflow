import { spawnSync } from "node:child_process";
import { logger } from './logger.js';
import { platform } from 'os';

/**
 * Cross-platform shell executor
 * - Windows: PowerShell Core (pwsh) or Windows PowerShell (powershell)
 * - macOS/Linux: bash or zsh
 */
export class Shell {
  private shellCmd!: string;
  private shellArgs!: string[];
  private readonly isWindows: boolean;

  constructor() {
    this.isWindows = platform() === 'win32';

    if (this.isWindows) {
      this.initializeWindowsShell();
    } else {
      this.initializeUnixShell();
    }
  }

  private initializeWindowsShell(): void {
    // Detect if pwsh exists
    try {
      const pwshCheck = spawnSync("pwsh", ["-c", "echo ok"], { encoding: "utf-8", cwd: process.cwd() });
      if (!pwshCheck.error) {
        this.shellCmd = "pwsh";
        this.shellArgs = ["-NoProfile", "-NoLogo", "-ExecutionPolicy", "Bypass", "-Command"];
        logger.debug('Using PowerShell Core (pwsh)');
      } else {
        this.shellCmd = "powershell";
        this.shellArgs = ["-NoProfile", "-NoLogo", "-ExecutionPolicy", "Bypass", "-Command"];
        logger.debug('Using Windows PowerShell (powershell)');
      }
    } catch (e) {
      // Fallback to powershell if pwsh check fails
      this.shellCmd = "powershell";
      this.shellArgs = ["-NoProfile", "-NoLogo", "-ExecutionPolicy", "Bypass", "-Command"];
      logger.warn('Failed to detect pwsh, falling back to powershell', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  private initializeUnixShell(): void {
    // Try to detect the best available shell on Unix systems
    const shells = ['bash', 'zsh', 'sh'];

    for (const shell of shells) {
      try {
        const check = spawnSync(shell, ["-c", "echo ok"], { encoding: "utf-8", cwd: process.cwd() });
        if (!check.error) {
          this.shellCmd = shell;
          this.shellArgs = ["-c"];
          logger.debug(`Using ${shell} shell`);
          return;
        }
      } catch (e) {
        // Continue to next shell
      }
    }

    // Fallback to bash if nothing else works
    this.shellCmd = "bash";
    this.shellArgs = ["-c"];
    logger.warn('Failed to detect preferred shell, falling back to bash');
  }

  /**
   * Execute a shell command and return stdout as string
   * @param command The command to execute
   */
  run(command: string): string {
    const startTime = Date.now();
    logger.debug(`Executing command: \n----\n${command}\n----`);
    try {
      if (this.isWindows) {
        return this.runWindowsCommand(command, startTime);
      } else {
        return this.runUnixCommand(command, startTime);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Shell execution failed after ${duration}ms`, error);
      return "";
    }
  }

  private runWindowsCommand(command: string, startTime: number): string {
    // For multiline commands, use base64 encoding (PowerShell specific)
    if (command.includes('\n') || command.includes('@\'') || command.includes('\'@')) {
      return this.runWindowsEncodedCommand(command, startTime);
    } else {
      return this.runWindowsSimpleCommand(command, startTime);
    }
  }

  private runWindowsEncodedCommand(command: string, startTime: number): string {
    // Encode the multiline command to base64 (PowerShell requires UTF-16LE encoding)
    const fullCommand = `[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8; ${command}`;
    const encodedCommand = Buffer.from(fullCommand, 'utf16le').toString('base64');

    const pwsh_args = [
      "-NoProfile",
      "-NoLogo",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encodedCommand
    ];

    logger.debug(`Executing encoded command: \n----\n${this.shellCmd} [multiline command]\n----`);
    const result = spawnSync(this.shellCmd, pwsh_args, { encoding: "utf-8", shell: true, cwd: process.cwd() });

    const duration = Date.now() - startTime;

    if (result.error) {
      logger.error(`Encoded command failed (${duration}ms): ${command.substring(0, 100)}...`, result.error);
      return "";
    }

    const output = result.stdout.replace(/[\r\n]+/g, "\n").trimEnd();
    logger.debug(`Encoded command output: \n----\n${output}\n----`);
    logger.debug(`Encoded command completed (${duration}ms)`, {
      command: command.substring(0, 100) + (command.length > 100 ? '...' : ''),
      output: output,
      outputLength: output.length,
      exitCode: result.status
    });

    return output;
  }

  private runWindowsSimpleCommand(command: string, startTime: number): string {
    // Single line command - use original method
    const pwsh_command = `"[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8; ${command.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    const pwsh_args = [...this.shellArgs, pwsh_command];

    logger.debug(`Executing command: \n----\n${command}\n----`);
    const result = spawnSync(this.shellCmd, pwsh_args, { encoding: "utf-8", shell: true, cwd: process.cwd() });

    const duration = Date.now() - startTime;

    if (result.error) {
      logger.error(`Command failed (${duration}ms): ${command}`, result.error);
      return "";
    }

    const output = result.stdout.replace(/[\r\n]+/g, "\n").trimEnd();
    logger.debug(`Command output: \n----\n${output}\n----`);
    logger.debug(`Command completed (${duration}ms)`, {
      command,
      output,
      outputLength: output.length,
      exitCode: result.status
    });

    return output;
  }

  private runUnixCommand(command: string, startTime: number): string {
    // For Unix systems, execute commands directly via shell
    const args = [...this.shellArgs, command];

    logger.debug(`Executing Unix command: \n----\n${this.shellCmd} ${args.join(' ')}\n----`);
    const result = spawnSync(this.shellCmd, args, { encoding: "utf-8", shell: false, cwd: process.cwd() });

    const duration = Date.now() - startTime;

    if (result.error) {
      logger.error(`Unix command failed (${duration}ms): ${command}`, result.error);
      return "";
    }

    const output = result.stdout.replace(/[\r\n]+/g, "\n").trimEnd();
    logger.debug(`Unix command output: \n----\n${output}\n----`);
    logger.debug(`Unix command completed (${duration}ms)`, {
      command,
      output,
      outputLength: output.length,
      exitCode: result.status
    });

    return output;
  }
}
