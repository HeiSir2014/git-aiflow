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
  }

  async sendMergeRequestNotice(
    branch: string,
    target: string,
    mrUrl: string,
    commitMsg: string,
    changedFiles: string[]
  ): Promise<void> {
    const fileList = changedFiles.length > 0 ? changedFiles.map((f) => `- ${f}`).join("\n") : "No changed files";

    const md = `🎉 **合并请求已创建**

> 📋 **分支合并**: \`${branch}\` → \`${target}\`  
> 🔗 **MR链接**: [点击查看详情](${mrUrl})

📝 **提交信息**
\`\`\`
${commitMsg}
\`\`\`

📁 **变更文件**
\`\`\`
${fileList}
\`\`\`

✨ _请及时进行代码审查_`;

    await this.http.requestJson(
      this.webhook,
      "POST",
      {"Content-Type": "application/json"},
      JSON.stringify({msgtype: "markdown", markdown: {content: md}})
    );
  }
}
