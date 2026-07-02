/**
 * 设置（/settings）。复刻 mvp_设置_设置.html：
 * 三卡片——大模型（本地/云端单选 + 连接徽标 + API Key + 隐私提示）、数据与备份（导出/导入 + 统计）、回收站（恢复/清空）。
 * 全部走真实后端：/settings/model、/settings/model/test、/stats、/health、/backup/*、/recycle*。
 */
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.ts';
import type { DataStats, Knowledge, ModelSettingsPublic } from '../api/types.ts';
import { useToast } from '../components/Toast.tsx';
import { ConfirmModal } from '../components/ConfirmModal.tsx';

export function SettingsPage() {
  const toast = useToast();
  const [model, setModel] = useState<ModelSettingsPublic | null>(null);
  const [conn, setConn] = useState<{ ok: boolean; detail: string } | null>(null);
  const [stats, setStats] = useState<DataStats | null>(null);
  const [recycle, setRecycle] = useState<Knowledge[]>([]);
  const [recycleTotal, setRecycleTotal] = useState(0);
  const [cloudKey, setCloudKey] = useState('');
  const [cloudBase, setCloudBase] = useState('');
  const [cloudModel, setCloudModel] = useState('');
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const reloadRecycle = useCallback(async () => {
    const r = await api.recycle(1, 50);
    setRecycle(r.items);
    setRecycleTotal(r.total);
  }, []);

  useEffect(() => {
    api.getModel().then((m) => {
      // 仅在尚未有值时应用初始加载，避免覆盖用户在加载期间的修改。
      setModel((prev) => prev ?? m);
      setCloudBase((prev) => prev || m.cloudBaseUrl);
      setCloudModel((prev) => prev || m.chatModel);
    }).catch((e) => toast.show(e instanceof ApiError ? e.message : '加载设置失败', 'danger'));
    api.health().then((h) => setConn(h.model)).catch(() => setConn({ ok: false, detail: '未连接' }));
    api.stats().then(setStats).catch(() => {});
    api.listLocalModels().then((r) => setLocalModels(r.models)).catch(() => setLocalModels([]));
    reloadRecycle().catch(() => {});
  }, [reloadRecycle, toast]);

  async function switchLocalModel(name: string) {
    try {
      const updated = await api.updateModel({ chatModel: name });
      setModel(updated);
      toast.show(`本地模型已切换为 ${name}`, 'success');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '切换失败', 'danger');
    }
  }

  async function switchProvider(provider: 'local' | 'cloud') {
    try {
      const updated = await api.updateModel({ provider });
      setModel(updated);
      toast.show(provider === 'local' ? '已切换到本地模型' : '已切换到云端模型', 'success');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '切换失败', 'danger');
    }
  }

  async function saveCloud() {
    try {
      const body: Record<string, string> = {};
      if (cloudBase) body.cloudBaseUrl = cloudBase;
      if (cloudModel) body.chatModel = cloudModel;
      if (cloudKey) body.cloudApiKey = cloudKey;
      const updated = await api.updateModel(body);
      setModel(updated);
      setCloudKey('');
      toast.show('云端配置已保存', 'success');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '保存失败', 'danger');
    }
  }

  async function testConn() {
    try {
      const r = await api.testModel();
      setConn(r);
      toast.show(r.ok ? `连接正常：${r.detail}` : `连接失败：${r.detail}`, r.ok ? 'success' : 'danger');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '测试失败', 'danger');
    }
  }

  async function exportBackup() {
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zkb-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.show('备份已导出', 'success');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '导出失败', 'danger');
    }
  }

  function importBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        const r = await api.importBackup(payload);
        toast.show(`已导入 ${r.imported} 条知识`, 'success');
        api.stats().then(setStats).catch(() => {});
      } catch (e) {
        toast.show(e instanceof ApiError ? e.message : '导入失败：文件格式非法', 'danger');
      }
    };
    input.click();
  }

  async function restore(id: string) {
    try {
      await api.restore(id);
      toast.show('已恢复', 'success');
      await reloadRecycle();
      api.stats().then(setStats).catch(() => {});
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '恢复失败', 'danger');
    }
  }

  async function doEmpty() {
    try {
      const r = await api.emptyRecycle();
      toast.show(`已清空 ${r.purged} 条`, 'success');
      setConfirmEmpty(false);
      await reloadRecycle();
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : '清空失败', 'danger');
    }
  }

  const provider = model?.provider ?? 'local';

  return (
    <>
      <header className="topbar"><h1 className="topbar-title">设置</h1></header>
      <div className="content" style={{ maxWidth: 760 }}>
        {/* 大模型 */}
        <div className="settings-card">
          <h2>大模型</h2>
          <div className="desc">用于自动整理、语义检索、问答。本地优先——数据不出本机；也可切换到云端大模型（速度更快、效果更强）。</div>

          <button className={`opt${provider === 'local' ? ' active' : ''}`} aria-pressed={provider === 'local'} onClick={() => switchProvider('local')} data-testid="opt-local">
            <span className="radio" />
            <span className="o-body">
              <span className="o-title">
                本地大模型（Ollama）
                <span className="badge badge-rec">推荐</span>
                <span className={`badge ${conn?.ok ? 'badge-ok' : 'badge-bad'}`} data-testid="conn-badge">
                  {conn === null ? '● 检测中' : conn.ok ? '● 已连接' : '● 未就绪'}
                </span>
              </span>
              <span className="o-sub">{model?.chatModel ?? '—'} · 数据完全不出本机，可离线使用</span>
            </span>
          </button>

          <button className={`opt${provider === 'cloud' ? ' active' : ''}`} aria-pressed={provider === 'cloud'} onClick={() => switchProvider('cloud')} data-testid="opt-cloud">
            <span className="radio" />
            <span className="o-body">
              <span className="o-title">云端大模型（API）</span>
              <span className="o-sub">DeepSeek / 通义 / 智谱等 OpenAI 兼容接口，速度快、效果强</span>
            </span>
          </button>

          {provider === 'cloud' && (
            <div onClick={(e) => e.stopPropagation()}>
              <div className="field">
                <label htmlFor="cloud-base">接口地址（baseUrl）</label>
                <input id="cloud-base" className="input" placeholder="https://api.deepseek.com/v1" value={cloudBase} onChange={(e) => setCloudBase(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="cloud-model">模型名</label>
                <input id="cloud-model" className="input" placeholder="deepseek-chat" value={cloudModel} onChange={(e) => setCloudModel(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="cloud-key">API Key{model?.hasCloudApiKey ? `（已配置 ${model.cloudApiKeyMasked}，留空不改）` : ''}</label>
                <input id="cloud-key" className="input" type="password" placeholder="sk-..." value={cloudKey} onChange={(e) => setCloudKey(e.target.value)} />
              </div>
              <div className="row-between" style={{ marginTop: 'var(--sp-3)' }}>
                <button className="btn btn-sm" onClick={testConn}>测试连接</button>
                <button className="btn btn-primary btn-sm" onClick={saveCloud}>保存云端配置</button>
              </div>
            </div>
          )}

          {provider === 'local' && (
            <>
              <div className="field">
                <label htmlFor="local-model">本地模型</label>
                <select
                  id="local-model"
                  className="input"
                  value={model?.chatModel ?? ''}
                  onChange={(e) => switchLocalModel(e.target.value)}
                >
                  {/* 当前模型即使未在已装列表中也保证可见 */}
                  {model && !localModels.includes(model.chatModel) && (
                    <option value={model.chatModel}>{model.chatModel}</option>
                  )}
                  {localModels.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="row-between" style={{ marginTop: 'var(--sp-3)' }}>
                <span className="stat">{conn?.detail ?? ''}</span>
                <button className="btn btn-sm" onClick={testConn}>测试连接</button>
              </div>
            </>
          )}

          <div className="privacy">
            <span>🔒</span>
            <div>使用云端大模型时，仅将<strong>必要的上下文</strong>发送到云端用于生成答案；你的完整知识库始终保存在本机。</div>
          </div>
        </div>

        {/* 数据与备份 */}
        <div className="settings-card">
          <h2>数据与备份</h2>
          <div className="desc">所有知识与索引都存在你本机。建议定期导出备份。</div>
          <div className="row-between">
            <div className="stat" data-testid="stats">
              📦 当前：{stats?.knowledge ?? 0} 条知识 · {stats?.tags ?? 0} 个标签 · {stats?.embeddings ?? 0} 个向量块
            </div>
            <button className="btn btn-primary" onClick={exportBackup}>⬇️ 导出备份</button>
          </div>
          <div className="row-between" style={{ marginTop: 'var(--sp-4)' }}>
            <div className="stat">从备份文件恢复数据</div>
            <button className="btn" onClick={importBackup}>⬆️ 导入备份</button>
          </div>
        </div>

        {/* 回收站 */}
        <div className="settings-card">
          <h2>🗑️ 回收站</h2>
          <div className="desc">删除的知识会先移到这里，可恢复。清空后不可找回。</div>
          {recycle.length === 0 ? (
            <div className="stat" data-testid="recycle-empty">回收站是空的。</div>
          ) : (
            recycle.map((k) => (
              <div className="recycle-row" key={k.id} data-testid="recycle-row">
                <span className="t">{k.title}</span>
                <button className="restore" onClick={() => restore(k.id)}>↩️ 恢复</button>
              </div>
            ))
          )}
          <div className="row-between" style={{ marginTop: 'var(--sp-4)' }}>
            <div className="stat">回收站中 {recycleTotal} 条</div>
            <button className="btn" onClick={() => setConfirmEmpty(true)} disabled={recycleTotal === 0}>清空回收站</button>
          </div>
        </div>
      </div>

      {confirmEmpty && (
        <ConfirmModal
          title="清空回收站？"
          body="回收站中的知识将被永久删除，不可恢复。"
          confirmLabel="永久清空"
          danger
          onCancel={() => setConfirmEmpty(false)}
          onConfirm={doEmpty}
        />
      )}
    </>
  );
}
