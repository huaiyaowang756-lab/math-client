import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

/** 从 localStorage 读取 token，供需要登录的请求使用 */
export function getAuthToken() {
  try {
    return localStorage.getItem('chat_token') || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token, expiresAt, username = null) {
  try {
    if (token) {
      localStorage.setItem('chat_token', token);
      if (expiresAt) localStorage.setItem('chat_token_expires', expiresAt);
      if (username != null) localStorage.setItem('chat_username', username);
    } else {
      localStorage.removeItem('chat_token');
      localStorage.removeItem('chat_token_expires');
      localStorage.removeItem('chat_username');
    }
  } catch (_) {}
}

export function getChatUsername() {
  try {
    return localStorage.getItem('chat_username') || '';
  } catch {
    return '';
  }
}

/** 是否在 10 分钟内登录过（未过期） */
export function isTokenValid() {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const exp = localStorage.getItem('chat_token_expires');
    if (!exp) return true;
    return new Date(exp) > new Date();
  } catch {
    return false;
  }
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) setAuthToken(null);
    return Promise.reject(err);
  }
);

/** 注册：返回 token、expires_at、user */
export async function register(username, password) {
  const res = await api.post('/auth/register/', { username, password });
  return res.data;
}

/** 登录：返回 token、expires_at、user */
export async function login(username, password) {
  const res = await api.post('/auth/login/', { username, password });
  return res.data;
}

/** 获取当前用户聊天记录（需登录） */
export async function getChatHistory() {
  const res = await api.get('/chat/history/');
  return res.data?.messages ?? [];
}

/** 保存当前用户聊天记录（需登录） */
export async function saveChatHistory(messages) {
  await api.post('/chat/history/save/', { messages });
}

export async function listLLMModels() {
  const res = await api.get('/llm-models/');
  return res.data?.models || [];
}

/** 统一聊天入口：意图识别后路由到推荐试题或闲聊 */
export async function chat(query, limit = 5, llmModel = null) {
  const body = { query, limit };
  if (llmModel) body.llm_model = llmModel;
  const res = await api.post('/chat/', body);
  return res.data;
}

/**
 * 流式聊天：支持多轮对话（最多 20 轮历史）。
 * @param {string} query - 当前用户输入
 * @param {number} limit - 推荐数量
 * @param {string|null} llmModel - 大模型
 * @param {function} onEvent - 事件回调
 * @param {object[]} [history] - 历史消息 [{ role, content, questions?, intent }]，最多 40 条
 */
export function chatStream(query, limit, llmModel, onEvent, history = []) {
  const body = JSON.stringify({
    query,
    limit,
    llm_model: llmModel || undefined,
    history: Array.isArray(history) ? history.slice(-40) : [],
  });
  const url = '/api/chat/stream/';
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json', Accept: 'text/event-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, {
    method: 'POST',
    headers,
    body,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const evt = JSON.parse(line.slice(6));
            onEvent?.(evt);
          } catch (_) {}
        }
      }
    }
    if (buf.startsWith('data: ')) {
      try {
        const evt = JSON.parse(buf.slice(6));
        onEvent?.(evt);
      } catch (_) {}
    }
  });
}

/** 直接推荐试题（跳过意图识别，用于兼容或显式调用） */
export async function recommendQuestions(query, limit = 5, llmModel = null) {
  const body = { query, limit };
  if (llmModel) body.llm_model = llmModel;
  const res = await api.post('/questions/recommend/', body);
  return res.data;
}

/**
 * 导出题目为 Word 试卷（多选后下载）。
 * @param {string[]} ids - 已入库题目 ID 列表
 * @param {string} mode - 'student' | 'teacher' | 'normal'
 * @param {object[]} [questions] - 未入库题目（如生成题）的完整对象列表，与 ids 可同时传
 * @returns {Promise<Blob>}
 */
export async function exportQuestionsDocx(ids, mode = 'student', questions = null) {
  const body = { ids: ids || [], mode };
  if (questions && questions.length > 0) body.questions = questions;
  const res = await api.post('/questions/export/', body, { responseType: 'blob' });
  return res.data;
}

export default api;
