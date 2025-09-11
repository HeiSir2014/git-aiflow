import chalk from 'chalk';

/**
 * Color utility for console output
 */
export class ColorUtil {
  /**
   * Color for different file statuses
   */
  static readonly FILE_STATUS_COLORS = {
    modified: chalk.yellow,
    untracked: chalk.blue,
    added: chalk.green,
    deleted: chalk.red,
    renamed: chalk.cyan,
    copied: chalk.magenta,
    unmerged: chalk.red.bold,
    ignored: chalk.gray
  };

  /**
   * Color for different log levels
   */
  static readonly LOG_COLORS = {
    info: chalk.blue,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    debug: chalk.gray,
    highlight: chalk.cyan.bold
  };

  /**
   * Color for different UI elements
   */
  static readonly UI_COLORS = {
    header: chalk.cyan.bold,
    separator: chalk.gray,
    prompt: chalk.yellow,
    selected: chalk.green.bold,
    cancelled: chalk.red,
    link: chalk.blue.underline,
    emoji: chalk.white,
    highlight: chalk.cyan.bold
  };

  /**
   * Get color for file status
   */
  static getFileStatusColor(status: string): (text: string) => string {
    switch (status.toLowerCase()) {
      case 'm':
      case 'modified':
        return this.FILE_STATUS_COLORS.modified;
      case 'a':
      case 'added':
        return this.FILE_STATUS_COLORS.added;
      case 'd':
      case 'deleted':
        return this.FILE_STATUS_COLORS.deleted;
      case 'r':
      case 'renamed':
        return this.FILE_STATUS_COLORS.renamed;
      case 'c':
      case 'copied':
        return this.FILE_STATUS_COLORS.copied;
      case 'u':
      case 'unmerged':
        return this.FILE_STATUS_COLORS.unmerged;
      case '?':
      case 'untracked':
        return this.FILE_STATUS_COLORS.untracked;
      case '!':
      case 'ignored':
        return this.FILE_STATUS_COLORS.ignored;
      default:
        return chalk.white;
    }
  }

  /**
   * Format file status with appropriate color
   */
  static formatFileStatus(filePath: string, status: string, index?: number): string {
    const color = this.getFileStatusColor(status);
    const prefix = index !== undefined ? `${index + 1}. ` : '';
    return `${prefix}${color(filePath)}`;
  }

  /**
   * Format file status with description
   */
  static formatFileStatusWithDescription(filePath: string, status: string, description: string, index?: number): string {
    const color = this.getFileStatusColor(status);
    const prefix = index !== undefined ? `${index + 1}. ` : '';
    return `${prefix}${color(filePath)} ${chalk.gray(`(${description})`)}`;
  }

  /**
   * Format git status line with colors
   */
  static formatGitStatusLine(line: string): string {
    if (!line || line.length < 3) return line;

    const status = line.substring(0, 2);
    const filePath = line.substring(3);

    // Parse git status format (XY filename)
    const workTreeStatus = status[1];

    let color = chalk.white;
    let statusText = '';

    if (workTreeStatus === 'M') {
      color = this.FILE_STATUS_COLORS.modified;
      statusText = 'modified';
    } else if (workTreeStatus === 'A') {
      color = this.FILE_STATUS_COLORS.added;
      statusText = 'added';
    } else if (workTreeStatus === 'D') {
      color = this.FILE_STATUS_COLORS.deleted;
      statusText = 'deleted';
    } else if (workTreeStatus === 'R') {
      color = this.FILE_STATUS_COLORS.renamed;
      statusText = 'renamed';
    } else if (workTreeStatus === 'C') {
      color = this.FILE_STATUS_COLORS.copied;
      statusText = 'copied';
    } else if (workTreeStatus === 'U') {
      color = this.FILE_STATUS_COLORS.unmerged;
      statusText = 'unmerged';
    } else if (status === '??') {
      color = this.FILE_STATUS_COLORS.untracked;
      statusText = 'untracked';
    } else if (status === '!!') {
      color = this.FILE_STATUS_COLORS.ignored;
      statusText = 'ignored';
    }
    return `${color(status)} ${color(filePath)} ${chalk.gray(`(${statusText})`)}`;
  }

  /**
   * Format success message
   */
  static success(message: string): string {
    return `${this.UI_COLORS.emoji('✅')} ${this.LOG_COLORS.success(message)}`;
  }

  /**
   * Format error message
   */
  static error(message: string): string {
    return `${this.UI_COLORS.emoji('❌')} ${this.LOG_COLORS.error(message)}`;
  }

  /**
   * Format warning message
   */
  static warning(message: string): string {
    return `${this.UI_COLORS.emoji('⚠️')} ${this.LOG_COLORS.warning(message)}`;
  }

  /**
   * Format info message
   */
  static info(message: string): string {
    return `${this.UI_COLORS.emoji('ℹ️')} ${this.LOG_COLORS.info(message)}`;
  }

  /**
   * Format header
   */
  static header(message: string): string {
    return this.UI_COLORS.header(message);
  }

  /**
   * Format separator line
   */
  static separator(char: string = '─', length: number = 50): string {
    return this.UI_COLORS.separator(char.repeat(length));
  }

  /**
   * Format prompt
   */
  static prompt(message: string): string {
    return this.UI_COLORS.prompt(message);
  }

  /**
   * Format selected item
   */
  static selected(message: string): string {
    return this.UI_COLORS.selected(message);
  }

  /**
   * Format link
   */
  static link(url: string): string {
    return this.UI_COLORS.link(url);
  }

  /**
   * Format MR/PR information
   */
  static formatMrInfo(title: string, url: string, branch: string, target: string): string {
    return `${this.UI_COLORS.emoji('🎉')} ${this.UI_COLORS.header(title)}
${this.UI_COLORS.emoji('📋')} ${this.LOG_COLORS.info('MR/PR 链接')}: ${this.link(url)}
${this.UI_COLORS.emoji('🌿')} ${this.LOG_COLORS.info('分支信息')}: ${this.LOG_COLORS.highlight(branch)} → ${this.LOG_COLORS.highlight(target)}`;
  }

  /**
   * Format file list with colors
   */
  static formatFileList(files: string[], maxDisplay: number = 10): string {
    if (files.length === 0) return '';

    const displayFiles = files.slice(0, maxDisplay);
    const remaining = files.length - maxDisplay;

    let result = displayFiles.map(file => `  ${this.UI_COLORS.emoji('•')} ${this.LOG_COLORS.info(file)}`).join('\n');

    if (remaining > 0) {
      result += `\n  ${this.UI_COLORS.emoji('...')} ${this.LOG_COLORS.debug(`${remaining}个文件`)}`;
    }

    return result;
  }

  /**
   * Dynamic countdown display
   */
  static async countdown(seconds: number, message: string, finalMessage?: string): Promise<void> {
    for (let i = seconds; i > 0; i--) {
      process.stdout.write(`\r${this.UI_COLORS.emoji('⏰')} ${this.LOG_COLORS.info(`${message} ${this.UI_COLORS.highlight(i)} seconds...`)}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Clear the line and show final message
    const final = finalMessage || message.replace(/\d+ seconds/, 'now');
    process.stdout.write(`\r${' '.repeat(process.stdout.columns - 1)}`);
    process.stdout.write(`\r${this.UI_COLORS.emoji('✅')} ${this.LOG_COLORS.success(final)}\n`);
  }

  /**
   * Dynamic progress display
   */
  static async progressBar(total: number, message: string, updateCallback: (current: number) => Promise<void>): Promise<void> {
    for (let i = 0; i <= total; i++) {
      const percentage = Math.round((i / total) * 100);
      const progress = '█'.repeat(Math.round(percentage / 2));
      const empty = '░'.repeat(50 - Math.round(percentage / 2));

      process.stdout.write(`\r${this.UI_COLORS.emoji('📊')} ${this.LOG_COLORS.info(message)} [${progress}${empty}] ${percentage}%`);

      if (i < total) {
        await updateCallback(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    process.stdout.write(`\r${' '.repeat(process.stdout.columns - 1)}`);
    process.stdout.write(`\n${this.UI_COLORS.emoji('✅')} ${this.LOG_COLORS.success('Progress completed!')}\n`);
  }

  /**
   * Dynamic spinner display
   */
  static async spinner(message: string, duration: number = 3000): Promise<void> {
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    const interval = setInterval(() => {
      process.stdout.write(`\r${spinnerChars[i % spinnerChars.length]} ${this.LOG_COLORS.info(message)}`);
      i++;
    }, 100);

    await new Promise(resolve => setTimeout(resolve, duration));
    clearInterval(interval);

    process.stdout.write(`\r${this.UI_COLORS.emoji('✅')} ${this.LOG_COLORS.success(message.replace('ing', 'ed'))}\n`);
  }
}
