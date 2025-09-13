import { logger } from '../logger.js';
import { HttpClient } from '../http/http-client.js';

/**
 * Enterprise WeCom notifier service
 */
export class WecomNotifier {
  private readonly webhook: string;
  private readonly http: HttpClient;

  constructor(webhook: string) {
    this.webhook = webhook;
    this.http = new HttpClient();
    logger.info('WecomNotifier initialized');
  }

  async sendMergeRequestNotice(
    branch: string,
    target: string,
    mrUrl: string,
    title: string,
    commitMsg: string,
    changedFiles: string[],
    mentionedMobileList?: string[],
    isAtAll?: boolean
  ): Promise<void> {
    logger.info(`Sending merge request notice: ${branch} → ${target}`);
    logger.debug(`MR URL: ${mrUrl}`);
    logger.debug(`Changed files count: ${changedFiles.length}`);

    const md = `🎉 **合并请求已创建，请及时进行代码审查！**
📋 **MR链接**: [点击查看](${mrUrl}) \`${mrUrl}\`
📝 **MR标题**: ${title}
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
      logger.info('Markdown notification sent successfully');
    } catch (error) {
      logger.error('Failed to send markdown notification:', error);
      throw error;
    }

    if ((mentionedMobileList && mentionedMobileList.length > 0) || isAtAll) {
      logger.info('Sending mention notification');
      logger.debug(`Mentioned mobile list: ${JSON.stringify(mentionedMobileList)}`);
      logger.debug(`Is @all: ${isAtAll}`);

      const content = `🎉 合并请求已创建，请及时进行代码审查！`;
      const _mentionedMobileListStr = mentionedMobileList?.filter(Boolean);
      if (isAtAll && !_mentionedMobileListStr?.some(mobile => mobile === '@all' || mobile === 'all')) {
        _mentionedMobileListStr?.push('@all');
      }
      if (!_mentionedMobileListStr || _mentionedMobileListStr.length === 0) {
        logger.warn('No valid mobile numbers to mention, skipping mention notification');
        return;
      }

      try {
        await this.http.requestJson(
          this.webhook,
          "POST",
          { "Content-Type": "application/json" },
          JSON.stringify({ msgtype: "text", text: { content, mentioned_mobile_list: _mentionedMobileListStr } })
        );
        logger.info(`Mention notification sent successfully to ${_mentionedMobileListStr.length} recipients`);
      } catch (error) {
        logger.error('Failed to send mention notification:', error);
        throw error;
      }
    }
  }
}
