/**
 * HTTP client using Node.js native fetch
 */
export class HttpClient {
  async requestJson<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<T> {
    const resp = await fetch(url, {method, headers, body});
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
    }
    return (await resp.json()) as T;
  }
}
