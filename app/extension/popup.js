/* 弹窗逻辑：抓当前页 outerHTML+url → POST /api/ingest/clip → 显示结果。 */
const DEFAULT_BACKEND = 'http://localhost:8787';
const $ = (id) => document.getElementById(id);

function showStatus(kind, html) {
  const el = $('status');
  el.className = `status show ${kind}`;
  el.innerHTML = html;
}

async function getBackend() {
  const { backend } = await chrome.storage.local.get('backend');
  return (backend || DEFAULT_BACKEND).replace(/\/+$/, '');
}

// 初始化后端地址输入框
(async () => {
  $('backend').value = await getBackend();
})();
$('backend').addEventListener('change', (e) => {
  chrome.storage.local.set({ backend: e.target.value.trim() });
});

$('clip').addEventListener('click', async () => {
  const btn = $('clip');
  btn.disabled = true;
  showStatus('info', '正在读取页面…');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:/.test(tab.url)) {
      throw new Error('当前标签页不是可剪藏的网页');
    }
    // 在页面上下文取完整渲染后的 HTML
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ url: location.href, html: document.documentElement.outerHTML }),
    });

    showStatus('info', '正在提取正文并入库…');
    const backend = await getBackend();
    const res = await fetch(`${backend}/api/ingest/clip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const msg = data?.error?.message || `入库失败 (${res.status})`;
      throw new Error(msg);
    }
    const tip = data.deduped ? '（该内容近期已剪藏，已去重）' : '';
    showStatus(
      'ok',
      `✅ 已剪藏《${escapeHtml(data.title || '未命名')}》${tip}<br/>AI 正在自动打标签和摘要。<a href="${backend.replace(':8787', ':5173')}/k/${data.id}" target="_blank">打开查看 →</a>`,
    );
  } catch (err) {
    showStatus(
      'err',
      `❌ ${escapeHtml(err.message)}<br/>请确认本地后端已启动（默认 http://localhost:8787），或在下方修改后端地址。`,
    );
  } finally {
    btn.disabled = false;
  }
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
