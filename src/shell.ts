import { spawnSync } from "node:child_process";

/**
 * Shell executor that prefers pwsh over powershell
 */
export class Shell {
  private readonly shellCmd: string;

  constructor() {
    // Detect if pwsh exists
    try {
      const pwshCheck = spawnSync("pwsh", ["-c", "echo ok"], { encoding: "utf-8", cwd: process.cwd() });
      if (!pwshCheck.error) {
        this.shellCmd = "pwsh";
      } else {
        this.shellCmd = "powershell";
      }
    } catch (e) {
      // Fallback to powershell if pwsh check fails
      console.debug("pwsh not available, using powershell");
      this.shellCmd = "powershell";
    }
  }

  /**
   * Execute a shell command and return stdout as string
   * @param command The command to execute
   */
  run(command: string): string {
    // For multiline commands, use a different approach with base64 encoding
    if (command.includes('\n') || command.includes('@\'') || command.includes('\'@')) {
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
      
      console.debug(`shell run: ${this.shellCmd} ${pwsh_args.slice(0, -1).join(" ")} -EncodedCommand [base64]`);
      const result = spawnSync(this.shellCmd, pwsh_args, { encoding: "utf-8", shell: true, cwd: process.cwd() });
      
      if (result.error) {
        console.error(`shell run failed: ${result.error.message}`);
        return "";
      }
      console.debug(`shell run result: ${result.stdout.trim().replace(/[\r\n]+/g, "\n").substring(0, 200)}`);
      return result.stdout.trim().replace(/[\r\n]+/g, "\n");
    } else {
      // Single line command - use original method
      const pwsh_command = `"[Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8; ${command.replace(/"/g, '\\"')}"`;
      const pwsh_args = ["-NoProfile", "-NoLogo", "-ExecutionPolicy", "Bypass", "-Command", pwsh_command];
      
      console.debug(`shell run: ${this.shellCmd} ${pwsh_args.join(" ")}`);
      const result = spawnSync(this.shellCmd, pwsh_args, { encoding: "utf-8", shell: true, cwd: process.cwd() });
      
      if (result.error) {
        console.error(`shell run failed: ${result.error.message}`);
        return "";
      }
      console.debug(`shell run result: ${result.stdout.trim().replace(/[\r\n]+/g, "\n").substring(0, 200)}`);
      return result.stdout.trim().replace(/[\r\n]+/g, "\n");
    }
  }
}
