/**
 * API 路由。所有处理函数从 ctx 取 db / provider 工厂，便于测试注入。
 * 校验用 zod；AI/写入入口挂限流；错误统一交 errorHandler。
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { Db } from './db.ts';
import type { LlmProvider } from './llm/provider.ts';
import { config } from './config.ts';
import { rateLimit } from './middleware/ratelimit.ts';
import { badRequest, notFound } from './middleware/error.ts';
import * as repo from './services/knowledge.ts';
import { ingest, processKnowledge, reindexKnowledge } from './services/pipeline.ts';
import { fetchAndExtract, extractArticle } from './services/extract.ts';
import { parseFile } from './services/fileparse.ts';
import { semanticSearch, relatedKnowledge } from './services/search.ts';
import { buildGraph } from './services/graph.ts';
import { answerQuestion } from './services/rag.ts';
import { exportData, importData } from './services/backup.ts';
import {
  getPublicModelSettings,
  getModelSettings,
  updateModelSettings,
} from './services/settings.ts';
import { createProvider, listLocalChatModels } from './llm/provider.ts';

export interface RouteCtx {
  db: Db;
  /** 按当前设置构造 provider（云端缺配置会 throw，交错误处理）。 */
  getProvider: () => LlmProvider;
  /** 触发后台 worker 立刻处理（录入后尽快整理）。可选。 */
  nudgeWorker?: () => void;
}

type Handler = (req: Request, res: Response) => Promise<void> | void;
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch(next);

function pageParams(req: Request): { page: number; pageSize: number } {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  return { page, pageSize };
}

const createSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().min(1, '内容不能为空'),
  source_type: z.enum(['paste', 'note']),
  source_url: z.string().url().optional().nullable(),
});

const linkSchema = z.object({ url: z.string().url('链接格式不合法') });
const clipSchema = z.object({
  url: z.string().url('链接格式不合法'),
  html: z.string().min(1, '页面内容为空'),
});
const fileSchema = z.object({
  filename: z.string().min(1),
  contentBase64: z.string().min(1),
});
const updateSchema = z.object({
  title: z.string().max(300).optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
});
const tagsSchema = z.object({ tags: z.array(z.string()).max(20) });
const askSchema = z.object({ question: z.string().min(1, '问题不能为空') });
const modelSchema = z.object({
  provider: z.enum(['local', 'cloud']).optional(),
  chatModel: z.string().optional(),
  embedModel: z.string().optional(),
  cloudBaseUrl: z.string().optional(),
  cloudApiKey: z.string().optional(),
});

export function buildRouter(ctx: RouteCtx): Router {
  const r = Router();
  const aiLimit = rateLimit('ai', config.aiRateLimitPerMin);
  const writeLimit = rateLimit('write', config.writeRateLimitPerMin);

  // ---- 健康检查 ----
  r.get(
    '/health',
    wrap(async (_req, res) => {
      let model: { ok: boolean; detail: string };
      try {
        model = await ctx.getProvider().health();
      } catch (err) {
        model = { ok: false, detail: (err as Error).message };
      }
      res.json({ status: 'ok', model });
    }),
  );

  // ---- 知识列表 ----
  r.get(
    '/knowledge',
    wrap((req, res) => {
      const { page, pageSize } = pageParams(req);
      const sourceType = req.query.source as repo.CreateInput['source_type'] | undefined;
      const valid = sourceType && ['link', 'paste', 'note', 'file'].includes(sourceType);
      res.json(repo.listKnowledge(ctx.db, { page, pageSize, sourceType: valid ? sourceType : undefined }));
    }),
  );

  // ---- 创建（粘贴 / 编辑器写）----
  r.post(
    '/knowledge',
    writeLimit,
    wrap((req, res) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? '参数非法');
      const { id, deduped } = ingest(ctx.db, {
        title: parsed.data.title ?? '',
        content: parsed.data.content,
        source_type: parsed.data.source_type,
        source_url: parsed.data.source_url ?? null,
      });
      ctx.nudgeWorker?.();
      res.status(201).json({ id, deduped });
    }),
  );

  // ---- 链接抓取录入 ----
  r.post(
    '/ingest/link',
    writeLimit,
    wrap(async (req, res) => {
      const parsed = linkSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? 'URL 非法');
      const article = await fetchAndExtract(parsed.data.url); // 失败抛 FetchError → 502 可回退
      const { id, deduped } = ingest(ctx.db, {
        title: article.title,
        content: article.content,
        source_type: 'link',
        source_url: parsed.data.url,
      });
      ctx.nudgeWorker?.();
      res.status(201).json({ id, deduped, title: article.title, viaWeixin: article.viaWeixin });
    }),
  );

  // ---- 浏览器剪藏录入（扩展把当前页 outerHTML+url 发来，服务端提取正文）----
  // 用浏览器已渲染/已登录的页面，天然绕过公众号等反爬；复用 extractArticle（含公众号适配）。
  r.post(
    '/ingest/clip',
    writeLimit,
    wrap((req, res) => {
      const parsed = clipSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? '参数非法');
      const article = extractArticle(parsed.data.html, parsed.data.url); // 提取不到正文抛 FetchError → 502
      const { id, deduped } = ingest(ctx.db, {
        title: article.title,
        content: article.content,
        source_type: 'link',
        source_url: parsed.data.url,
      });
      ctx.nudgeWorker?.();
      res.status(201).json({ id, deduped, title: article.title, viaWeixin: article.viaWeixin });
    }),
  );

  // ---- 文件上传录入（base64 JSON，避免 multipart 复杂度）----
  r.post(
    '/ingest/file',
    writeLimit,
    wrap(async (req, res) => {
      const parsed = fileSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? '文件参数非法');
      const buf = Buffer.from(parsed.data.contentBase64, 'base64');
      const parsedFile = await parseFile(parsed.data.filename, buf); // ParseError → 422
      const { id, deduped } = ingest(ctx.db, {
        title: parsedFile.title,
        content: parsedFile.content,
        source_type: 'file',
        source_url: null,
      });
      ctx.nudgeWorker?.();
      res.status(201).json({ id, deduped, title: parsedFile.title });
    }),
  );

  // ---- 知识详情 ----
  r.get(
    '/knowledge/:id',
    wrap((req, res) => {
      const k = repo.getKnowledge(ctx.db, req.params.id);
      if (!k) throw notFound('知识不存在或已删除');
      res.json(k);
    }),
  );

  // ---- 相关推荐 ----
  r.get(
    '/knowledge/:id/related',
    wrap((req, res) => {
      const k = repo.getKnowledge(ctx.db, req.params.id);
      if (!k) throw notFound('知识不存在或已删除');
      const limit = Math.min(10, Math.max(1, Number(req.query.limit) || 5));
      res.json({ items: relatedKnowledge(ctx.db, req.params.id, limit) });
    }),
  );

  // ---- 编辑（保存后重建 embedding）----
  r.patch(
    '/knowledge/:id',
    writeLimit,
    wrap(async (req, res) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? '参数非法');
      const existing = repo.getKnowledge(ctx.db, req.params.id);
      if (!existing) throw notFound('知识不存在或已删除');
      const { contentChanged } = repo.updateKnowledge(ctx.db, req.params.id, parsed.data);
      if (contentChanged) {
        try {
          await reindexKnowledge(ctx.db, ctx.getProvider(), req.params.id);
        } catch (err) {
          req.log.warn('编辑后重建向量失败，置 pending 待 worker 重试', {
            error: (err as Error).message,
          });
          repo.setOrganizeStatus(ctx.db, req.params.id, 'pending');
          ctx.nudgeWorker?.();
        }
      }
      res.json(repo.getKnowledge(ctx.db, req.params.id));
    }),
  );

  // ---- 标签编辑（详情页加/删标签）----
  r.patch(
    '/knowledge/:id/tags',
    writeLimit,
    wrap((req, res) => {
      const parsed = tagsSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest('标签参数非法');
      const existing = repo.getKnowledge(ctx.db, req.params.id);
      if (!existing) throw notFound('知识不存在或已删除');
      repo.setTags(ctx.db, req.params.id, parsed.data.tags);
      res.json(repo.getKnowledge(ctx.db, req.params.id));
    }),
  );

  // ---- 软删除（移回收站）----
  r.delete(
    '/knowledge/:id',
    wrap((req, res) => {
      const ok = repo.softDelete(ctx.db, req.params.id);
      if (!ok) throw notFound('知识不存在或已在回收站');
      res.json({ ok: true });
    }),
  );

  // ---- 检索 ----
  r.get(
    '/search',
    aiLimit,
    wrap(async (req, res) => {
      const q = String(req.query.q ?? '').trim();
      if (!q) throw badRequest('检索词不能为空', 'EMPTY_QUERY'); // B-BND-10
      const topK = Math.min(20, Math.max(1, Number(req.query.topK) || config.topK));
      const result = await semanticSearch(ctx.db, ctx.getProvider(), q, { topK });
      res.json(result);
    }),
  );

  // ---- 问答 RAG ----
  r.post(
    '/ask',
    aiLimit,
    wrap(async (req, res) => {
      const parsed = askSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? '问题非法');
      const result = await answerQuestion(ctx.db, ctx.getProvider(), parsed.data.question);
      res.json(result);
    }),
  );

  // ---- 标签云 + 按标签 ----
  r.get(
    '/tags',
    wrap((_req, res) => {
      res.json({ items: repo.listTagsWithCount(ctx.db) });
    }),
  );
  r.get(
    '/tags/:name',
    wrap((req, res) => {
      const { page, pageSize } = pageParams(req);
      res.json(repo.listByTag(ctx.db, req.params.name, { page, pageSize }));
    }),
  );

  // ---- 回收站 ----
  r.get(
    '/recycle',
    wrap((req, res) => {
      const { page, pageSize } = pageParams(req);
      res.json(repo.listDeleted(ctx.db, { page, pageSize }));
    }),
  );
  r.post(
    '/recycle/:id/restore',
    wrap((req, res) => {
      const ok = repo.restore(ctx.db, req.params.id);
      if (!ok) throw notFound('回收站中无此条目');
      res.json({ ok: true });
    }),
  );
  r.delete(
    '/recycle/:id',
    wrap((req, res) => {
      const ok = repo.purge(ctx.db, req.params.id);
      if (!ok) throw notFound('回收站中无此条目');
      res.json({ ok: true });
    }),
  );
  r.delete(
    '/recycle',
    wrap((_req, res) => {
      res.json({ purged: repo.emptyRecycle(ctx.db) });
    }),
  );

  // ---- 设置：模型 ----
  r.get(
    '/settings/model',
    wrap((_req, res) => {
      res.json(getPublicModelSettings(ctx.db));
    }),
  );
  r.put(
    '/settings/model',
    wrap((req, res) => {
      const parsed = modelSchema.safeParse(req.body);
      if (!parsed.success) throw badRequest('设置参数非法');
      updateModelSettings(ctx.db, parsed.data);
      res.json(getPublicModelSettings(ctx.db));
    }),
  );
  // 列出本地可对话模型（设置页下拉用）。
  r.get(
    '/settings/local-models',
    wrap(async (_req, res) => {
      const models = await listLocalChatModels();
      res.json({ models });
    }),
  );

  r.post(
    '/settings/model/test',
    aiLimit,
    wrap(async (_req, res) => {
      // 用当前持久化设置构造 provider 测连通（云端缺配置 createProvider 抛 → 400）。
      const provider = createProvider(getModelSettings(ctx.db));
      const health = await provider.health();
      res.json(health);
    }),
  );

  // ---- 关系图谱（阶段二③）----
  r.get(
    '/graph',
    wrap((req, res) => {
      const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 120));
      const minRelevance = Math.min(100, Math.max(0, Number(req.query.minRelevance) || 55));
      res.json(buildGraph(ctx.db, { limit, minRelevance }));
    }),
  );

  // ---- 数据统计 ----
  r.get(
    '/stats',
    wrap((_req, res) => {
      res.json(repo.dataStats(ctx.db));
    }),
  );

  // ---- 备份 ----
  r.get(
    '/backup/export',
    wrap((_req, res) => {
      res.json(exportData(ctx.db));
    }),
  );
  r.post(
    '/backup/import',
    writeLimit,
    wrap((req, res) => {
      const result = importData(ctx.db, req.body);
      ctx.nudgeWorker?.();
      res.json(result);
    }),
  );

  // ---- 测试/内部：同步处理一条（仅非生产可用，方便 e2e 立即整理）----
  r.post(
    '/internal/process/:id',
    wrap(async (req, res) => {
      const result = await processKnowledge(ctx.db, ctx.getProvider(), req.params.id);
      res.json(result);
    }),
  );

  return r;
}
