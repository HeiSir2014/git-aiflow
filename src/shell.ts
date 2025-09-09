import { spawnSync } from "node:child_process";
import { createLogger } from './logger.js';

/**
 * Shell executor that prefers pwsh over powershell
 */
export class Shell {
  private readonly shellCmd: string;
  private readonly logger = createLogger('Shell');

  constructor() {
    // Detect if pwsh exists
    try {
      const pwshCheck = spawnSync("pwsh", ["-c", "echo ok"], {encoding: "utf-8", cwd: process.cwd()});
      if (!pwshCheck.error) {
        this.shellCmd = "pwsh";
        this.logger.debug('Using PowerShell Core (pwsh)');
      } else {
        this.shellCmd = "powershell";
        this.logger.debug('Using Windows PowerShell (powershell)');
      }
    } catch (e) {
      // Fallback to powershell if pwsh check fails
      this.shellCmd = "powershell";
      this.logger.warn('Failed to detect pwsh, falling back to powershell', { error: e instanceof Error ? e.message : String(e) });
    }
  }

  /**
   * Execute a shell command and return stdout as string
   * @param command The command to execute
   */
  run(command: string): string {
    const startTime = Date.now();
    
    try {
      // For multiline commands, use a different approach with base64 encoding
      if (command.includes('\n') || command.includes('@\'') || command.includes('\'@')) {
        return this.runEncodedCommand(command, startTime);
      } else {
        return this.runSimpleCommand(command, startTime);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Shell execution failed after ${duration}ms`, error);
      return "";
    }
  }

  private runEncodedCommand(command: string, startTime: number): string {
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
    
    this.logger.debug(`Executing encoded command: ${this.shellCmd} [multiline command]`);
    const result = spawnSync(this.shellCmd, pwsh_args, {encoding: "utf-8", shell: true, cwd: process.cwd()});
    
    const duration = Date.now() - startTime;
    
    if (result.error) {
      this.logger.error(`Encoded command failed (${duration}ms): ${command.substring(0, 100)}...`, result.error);
      return "";
    }
    
    const output = result.stdout.trim().replace(/[\r\n]+/g, "\n");
    this.logger.debug(`Encoded command completed (${duration}ms)`, { 
      command: command.substring(0, 100) + (command.length > 100 ? '...' : ''),
      output: output,
      outputLength: output.length,
      exitCode: result.status 
    });
    
    return output;
  }

  private runSimpleCommand(command: string, startTime: number): string {
    // Single line command - use original method
    const pwsh_command = `"[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8; ${command.replace(/"/g, '\\"')}"`;
    const pwsh_args = ["-NoProfile", "-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", pwsh_command];
    
    this.logger.debug(`Executing command: ${command}`);
    const result = spawnSync(this.shellCmd, pwsh_args, {encoding: "utf-8", shell: true, cwd: process.cwd()});
    
    const duration = Date.now() - startTime;
    
    if (result.error) {
      this.logger.error(`Command failed (${duration}ms): ${command}`, result.error);
      return "";
    }
    
    const output = result.stdout.trim().replace(/[\r\n]+/g, "\n");
    this.logger.debug(`Command completed (${duration}ms)`, { 
      command,
      output,
      outputLength: output.length,
      exitCode: result.status 
    });
    
    return output;
  }
}
