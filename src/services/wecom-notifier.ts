import { createLogger } from '../logger.js';
import { HttpClient } from '../http/http-client.js';

/**
 * Enterprise WeCom notifier service
 */
export class WecomNotifier {
  private readonly webhook: string;
  private readonly http: HttpClient;
  private readonly logger = createLogger('WecomNotifier');

  constructor(webhook: string) {
    this.webhook = webhook;
    this.http = new HttpClient();
    this.logger.info('WecomNotifier initialized');
  }

  async sendMergeRequestNotice(
    branch: string,
    target: string,
    mrUrl: string,
    commitMsg: string,
    changedFiles: string[],
    mentionedMobileList?: string[],
    isAtAll?: boolean
  ): Promise<void> {
    this.logger.info(`Sending merge request notice: ${branch} → ${target}`);
    this.logger.debug(`MR URL: ${mrUrl}`);
    this.logger.debug(`Changed files count: ${changedFiles.length}`);

    const md = `🎉 **合并请求已创建，请及时进行代码审查！**
📋 **MR链接**: [点击查看](${mrUrl}) \`${mrUrl}\`
🌿 **分支信息**: ${branch} → ${target}
📝 **提交信息**:
\`\`\`
${commitMsg}
\`\`\`
📁 **变更文件** (${changedFiles.length} 个)${changedFiles.length > 10 ? `**前10个**: ` : ': '}
\`\`\`
${changedFiles.slice(0, 10).map(file => `• ${file}`).join('\n')}${changedFiles.length > 10 ? `\n**...还有 ${changedFiles.length - 10} 个文件**` : ''}
\`\`\`
`;

    try {
      await this.http.requestJson(
        this.webhook,
        "POST",
        { "Content-Type": "application/json" },
        JSON.stringify({ msgtype: "markdown_v2", markdown_v2: { content: md } })
      );
      this.logger.info('Markdown notification sent successfully');
    } catch (error) {
      this.logger.error('Failed to send markdown notification:', error);
      throw error;
    }

    if ((mentionedMobileList && mentionedMobileList.length > 0) || isAtAll) {
      this.logger.info('Sending mention notification');
      this.logger.debug(`Mentioned mobile list: ${JSON.stringify(mentionedMobileList)}`);
      this.logger.debug(`Is @all: ${isAtAll}`);

      const content = `🎉 合并请求已创建，请及时进行代码审查！`;
      const _mentionedMobileListStr = mentionedMobileList?.filter(Boolean);
      if (isAtAll && !_mentionedMobileListStr?.some(mobile => mobile === '@all' || mobile === 'all')) {
        _mentionedMobileListStr?.push('@all');
      }
      if (!_mentionedMobileListStr || _mentionedMobileListStr.length === 0) {
        this.logger.warn('No valid mobile numbers to mention, skipping mention notification');
        return;
      }

      try {
        await this.http.requestJson(
          this.webhook,
          "POST",
          { "Content-Type": "application/json" },
          JSON.stringify({ msgtype: "text", text: { content, mentioned_mobile_list: _mentionedMobileListStr } })
        );
        this.logger.info(`Mention notification sent successfully to ${_mentionedMobileListStr.length} recipients`);
      } catch (error) {
        this.logger.error('Failed to send mention notification:', error);
        throw error;
      }
    }
  }
}
