/**
 * HTTP client using Node.js native fetch
 */
import { logger } from '../logger.js';

export class HttpClient {

  async requestJson<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<T> {
    const startTime = Date.now();
    logger.httpRequest(method, url);

    const resp = await fetch(url, { method, headers, body });
    const duration = Date.now() - startTime;

    if (!resp.ok) {
      const errorText = await resp.text();
      logger.error(`HTTP ${method} ${url} failed (${duration}ms)`, {
        status: resp.status,
        error: errorText
      });
      throw new Error(`HTTP ${resp.status}: ${errorText}`);
    }

    const result = await resp.json() as T;
    logger.httpRequest(method, url, resp.status, duration);
    return result;
  }

  async requestText(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<string> {
    const startTime = Date.now();
    logger.httpRequest(method, url);

    const resp = await fetch(url, { method, headers, body });
    const duration = Date.now() - startTime;

    if (!resp.ok) {
      const errorText = await resp.text();
      logger.error(`HTTP ${method} ${url} failed (${duration}ms)`, {
        status: resp.status,
        error: errorText
      });
      throw new Error(`HTTP ${resp.status}: ${errorText}`);
    }

    const result = await resp.text();
    logger.httpRequest(method, url, resp.status, duration);
    return result;
  }

  async requestBinary(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<Uint8Array> {
    const startTime = Date.now();
    logger.httpRequest(method, url);

    const resp = await fetch(url, { method, headers, body });
    const duration = Date.now() - startTime;

    if (!resp.ok) {
      const errorText = await resp.text();
      logger.error(`HTTP ${method} ${url} failed (${duration}ms)`, {
        status: resp.status,
        error: errorText
      });
      throw new Error(`HTTP ${resp.status}: ${errorText}`);
    }

    const result = new Uint8Array(await resp.arrayBuffer());
    logger.httpRequest(method, url, resp.status, duration);
    return result;
  }

  async requestStream(
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<ReadableStream<any>> {
    const startTime = Date.now();
    logger.httpRequest(method, url);

    const resp = await fetch(url, { method, headers, body });
    const duration = Date.now() - startTime;

    if (!resp.ok) {
      const errorText = await resp.text();
      logger.error(`HTTP ${method} ${url} failed (${duration}ms)`, {
        status: resp.status,
        error: errorText
      });
      throw new Error(`HTTP ${resp.status}: ${errorText}`);
    }

    logger.httpRequest(method, url, resp.status, duration);
    return resp.body as ReadableStream<any>;
  }

  async requestHead(
    url: string,
    headers: Record<string, string>
  ): Promise<Response> {
    const startTime = Date.now();
    logger.httpRequest('HEAD', url);

    const resp = await fetch(url, { method: 'HEAD', headers });
    const duration = Date.now() - startTime;

    logger.httpRequest('HEAD', url, resp.status, duration);
    return resp;
  }
}
