/**
 * 统一错误处理：把已知领域错误映射到 HTTP 状态码 + 结构化错误体，
 * 未知错误记 error 日志并返回 500（不静默吞错）。
 */
import type { Request, Response, NextFunction } from 'express';
import { FetchError } from '../services/extract.ts';
import { ParseError } from '../services/fileparse.ts';
import { LlmError } from '../llm/provider.ts';
import { OrganizeError } from '../services/organize.ts';
import { ImportError } from '../services/backup.ts';

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function badRequest(message: string, code = 'BAD_REQUEST'): HttpError {
  return new HttpError(400, code, message);
}
export function notFound(message: string, code = 'NOT_FOUND'): HttpError {
  return new HttpError(404, code, message);
}

function toApiError(err: unknown): { status: number; body: ApiError } {
  if (err instanceof HttpError) {
    return { status: err.status, body: { code: err.code, message: err.message, retryable: err.retryable } };
  }
  if (err instanceof FetchError) {
    return {
      status: 502,
      body: { code: `FETCH_${err.kind.toUpperCase()}`, message: err.message, retryable: true },
    };
  }
  if (err instanceof LlmError) {
    const status = err.kind === 'config' ? 400 : 502;
    return { status, body: { code: `LLM_${err.kind.toUpperCase()}`, message: err.message, retryable: err.retryable } };
  }
  if (err instanceof ParseError) {
    return { status: 422, body: { code: 'PARSE_ERROR', message: err.message, retryable: false } };
  }
  if (err instanceof OrganizeError) {
    return { status: 502, body: { code: 'ORGANIZE_ERROR', message: err.message, retryable: true } };
  }
  if (err instanceof ImportError) {
    return { status: 400, body: { code: 'IMPORT_INVALID', message: err.message, retryable: false } };
  }
  return { status: 500, body: { code: 'INTERNAL', message: (err as Error).message || '服务器内部错误', retryable: false } };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const { status, body } = toApiError(err);
  if (status >= 500) {
    req.log?.error('请求异常', { code: body.code, message: body.message, stack: (err as Error).stack });
  } else {
    req.log?.warn('请求被拒', { code: body.code, message: body.message });
  }
  res.status(status).json({ error: body, traceId: req.traceId });
}
