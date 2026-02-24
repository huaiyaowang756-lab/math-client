import { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Button, List, Spin, Empty, ConfigProvider, Select, Tooltip, Avatar, Drawer } from 'antd';
import { SendOutlined, AppstoreOutlined, AudioOutlined, FileTextOutlined, UserOutlined, LogoutOutlined } from '@ant-design/icons';
import {
  chatStream,
  listLLMModels,
  exportQuestionsDocx,
  getAuthToken,
  setAuthToken,
  getChatHistory,
  saveChatHistory,
  getChatUsername,
} from './api';
import QuestionCard from './components/QuestionCard';
import AuthPage from './pages/AuthPage';
import { parseGeneratedQuestion } from './utils/parseGeneratedQuestion';
import './index.css';

const { TextArea } = Input;

/** 生成题目卡片的稳定 key（用于多选） */
function getQuestionCardKey(messageIndex, question, questionIndex) {
  const id = question?.id;
  if (id && !String(id).startsWith('generated')) return `${messageIndex}-${id}`;
  return `${messageIndex}-gen-${questionIndex}`;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [llmModels, setLLMModels] = useState([]);
  const [selectedLLM, setSelectedLLM] = useState(null);
  const [downloadMode, setDownloadMode] = useState(null);
  const [paperSelectMode, setPaperSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const listRef = useRef(null);
  const saveTimerRef = useRef(null);
  const loadedHistoryRef = useRef(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /** 收集当前选中的题目（来自所有消息） */
  const selectedQuestions = (() => {
    const list = [];
    messages.forEach((m, msgIdx) => {
      if (m.role !== 'assistant' || !m.questions?.length) return;
      m.questions.forEach((q, qIdx) => {
        const key = getQuestionCardKey(msgIdx, q, qIdx);
        if (selectedKeys.has(key)) list.push(q);
      });
    });
    return list;
  })();

  const handleDownloadPaper = useCallback(async (mode = 'student') => {
    const list = selectedQuestions;
    const ids = list.filter((q) => q.id && !String(q.id).startsWith('generated')).map((q) => q.id);
    const questions = list.filter((q) => !q.id || String(q.id).startsWith('generated')).map((q) => ({
      questionType: q.questionType ?? q.question_type,
      questionBody: q.questionBody ?? q.question_body ?? [],
      answer: q.answer ?? [],
      analysis: q.analysis ?? [],
      detailedSolution: q.detailedSolution ?? q.detailed_solution ?? [],
      assetBaseUrl: q.assetBaseUrl ?? q.asset_base_url ?? '',
    }));
    if (!ids.length && !questions.length) return;
    setDownloadMode(mode);
    try {
      const blob = await exportQuestionsDocx(ids, mode, questions.length ? questions : null);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `试卷_${mode === 'teacher' ? '教师版' : mode === 'student' ? '学生版' : '普通版'}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloadMode(null);
    }
  }, [selectedQuestions]);

  const toggleQuestionSelect = useCallback((checked, cardKey) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(cardKey);
      else next.delete(cardKey);
      return next;
    });
  }, []);

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    loadedHistoryRef.current = false;
    setAuthenticated(false);
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (!getAuthToken()) {
      setAuthenticated(false);
      return;
    }
    getChatHistory()
      .then((ms) => {
        setMessages(Array.isArray(ms) ? ms : []);
        setAuthenticated(true);
        loadedHistoryRef.current = true;
      })
      .catch((err) => {
        if (err.response?.status === 401) setAuthToken(null);
        setAuthenticated(false);
        loadedHistoryRef.current = false;
      });
  }, []);

  const handleAuthSuccess = useCallback(() => {
    setAuthenticated(true);
    loadedHistoryRef.current = false;
  }, []);

  useEffect(() => {
    if (authenticated !== true || loadedHistoryRef.current) return;
    loadedHistoryRef.current = true;
    getChatHistory()
      .then((ms) => setMessages(Array.isArray(ms) ? ms : []))
      .catch(() => {});
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !messages.length) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveChatHistory(messages).catch((err) => {
        if (err.response?.status === 401) {
          setAuthToken(null);
          loadedHistoryRef.current = false;
          setAuthenticated(false);
        }
      });
      saveTimerRef.current = null;
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [authenticated, messages]);

  useEffect(() => {
    listLLMModels().then(setLLMModels).catch(() => setLLMModels([]));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const handleSend = async () => {
    const q = query.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setQuery('');
    setLoading(true);

    const placeholder = { role: 'assistant', content: '正在处理...', questions: [] };
    setMessages((prev) => [...prev, placeholder]);
    const idx = messages.length + 1;
    const intentRef = { current: '' };
    const historyForApi = messages.slice(-40);

    chatStream(q, 5, selectedLLM || null, (evt) => {
      if (evt.type === 'started') {
        setMessages((prev) => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx], content: '正在识别意图…' };
          return next;
        });
      } else if (evt.type === 'intent') {
        intentRef.current = evt.intent || '';
        const tips = {
          generate_questions: '正在生成题目...',
          recommend_questions: '正在为您推荐题目...',
          assemble_paper: '正在组卷...',
          chat: '正在思考...',
        };
        setMessages((prev) => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx], content: tips[evt.intent] || '正在处理...' };
          return next;
        });
      } else if (evt.type === 'chunk') {
        setMessages((prev) => {
          const next = [...prev];
          if (next[idx]) next[idx] = { ...next[idx], content: (next[idx].content || '') + (evt.content || '') };
          return next;
        });
      } else if (evt.type === 'done') {
        setMessages((prev) => {
          const next = [...prev];
          let content = evt.content ?? '';
          let questions = evt.questions || [];
          if (intentRef.current === 'generate_questions' && content) {
            const parsed = parseGeneratedQuestion(content);
            if (parsed && parsed.questionBody?.length > 0) {
              questions = [{ id: 'generated', ...parsed }];
              content = '已根据您的描述生成一道题目：';
            }
          }
          next[idx] = { role: 'assistant', content, questions, intent: evt.intent };
          return next;
        });
      } else if (evt.type === 'error') {
        setMessages((prev) => {
          const next = [...prev];
          next[idx] = { role: 'assistant', content: `请求失败：${evt.error || '未知错误'}` };
          return next;
        });
      }
    }, historyForApi)
      .catch((err) => {
        const msg = err?.message || '请求失败';
        setMessages((prev) => {
          const next = [...prev];
          next[idx] = { role: 'assistant', content: `请求失败：${msg}` };
          return next;
        });
      })
      .finally(() => setLoading(false));
  };

  if (authenticated === null) {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: '#4f46e5' } }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <Spin size="large" description="加载中..." />
        </div>
      </ConfigProvider>
    );
  }

  if (authenticated === false) {
    return <AuthPage onSuccess={handleAuthSuccess} />;
  }

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 8 },
      }}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxWidth: 720,
        margin: '0 auto',
        width: '100%',
        background: '#fff',
      }}>
        <header
          style={{
            flexShrink: 0,
            height: 52,
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #f0f0f0',
            background: '#fff',
          }}
        >
          <Avatar
            size={36}
            icon={<UserOutlined />}
            style={{ backgroundColor: '#4f46e5', cursor: 'pointer' }}
            onClick={() => setDrawerOpen(true)}
          />
          <span style={{ marginLeft: 12, fontSize: 15, color: '#1f2937', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(getChatUsername() || '').slice(0, 6) || '数学题目助手'}
          </span>
          <Button
            type="link"
            size="small"
            style={{ marginLeft: 'auto', fontSize: 13 }}
            onClick={() => {
              setMessages([]);
              if (getAuthToken()) saveChatHistory([]).catch(() => {});
            }}
          >
            新话题
          </Button>
        </header>

        <Drawer
          title="账户"
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={280}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>登录状态</div>
            <div style={{ fontSize: 15 }}>
              {getChatUsername() ? `已登录：${getChatUsername()}` : '已登录'}
            </div>
          </div>
          <Button
            type="default"
            danger
            icon={<LogoutOutlined />}
            block
            onClick={handleLogout}
          >
            退出登录
          </Button>
        </Drawer>

        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
          }}
        >
            {messages.length === 0 && !loading && (
              <Empty description="在下方输入框输入需求开始" style={{ marginTop: 80 }} />
            )}
            <List
              dataSource={messages}
              renderItem={(m, msgIdx) => (
                <List.Item
                  style={{
                    justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                    border: 'none',
                    padding: '8px 0',
                    flexDirection: 'column',
                    alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                    display: 'flex',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: m.role === 'user' ? '#4f46e5' : '#fff',
                      color: m.role === 'user' ? '#fff' : '#1f2937',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    {m.content}
                  </div>
                  {m.role === 'assistant' && m.questions?.length > 0 && (
                    <div style={{ maxWidth: '100%', marginTop: 12 }}>
                      {m.questions.map((q, qi) => {
                        const cardKey = getQuestionCardKey(msgIdx, q, qi);
                        return (
                          <QuestionCard
                            key={cardKey}
                            cardKey={cardKey}
                            question={q}
                            selectable={paperSelectMode}
                            checked={selectedKeys.has(cardKey)}
                            onCheckChange={toggleQuestionSelect}
                          />
                        );
                      })}
                    </div>
                  )}
                </List.Item>
              )}
            />
            {loading && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin tip="正在处理..." />
              </div>
            )}
        </div>

        {paperSelectMode && (
          <div
            style={{
              flexShrink: 0,
              padding: '10px 16px',
              borderTop: '1px solid #f0f0f0',
              background: '#fafafa',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <span style={{ color: '#666', fontSize: 13 }}>
              已选 {selectedQuestions.length} 道题
            </span>
            <Button
              type="primary"
              size="small"
              loading={downloadMode === 'student'}
              disabled={selectedQuestions.length === 0}
              onClick={() => handleDownloadPaper('student')}
            >
              下载学生卷
            </Button>
            <Button
              size="small"
              loading={downloadMode === 'teacher'}
              disabled={selectedQuestions.length === 0}
              onClick={() => handleDownloadPaper('teacher')}
            >
              下载教师卷
            </Button>
            <Button
              size="small"
              loading={downloadMode === 'normal'}
              disabled={selectedQuestions.length === 0}
              onClick={() => handleDownloadPaper('normal')}
            >
              下载普通卷
            </Button>
          </div>
        )}

        <div style={{
          flexShrink: 0,
          padding: '12px 16px 16px',
          borderTop: paperSelectMode ? 'none' : '1px solid #f0f0f0',
          background: '#fff',
        }}>
          <TextArea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder='发消息或输入 "/" 选择技能'
            autoSize={{ minRows: 3, maxRows: 6 }}
            disabled={loading}
            style={{ marginBottom: 10, resize: 'none' }}
          />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}>
            {llmModels.length > 0 && (
              <Select
                placeholder="选择大模型"
                allowClear
                style={{ width: 160 }}
                value={selectedLLM || undefined}
                onChange={(v) => setSelectedLLM(v || null)}
                options={llmModels.map((m) => ({ label: m.name, value: m.model }))}
              />
            )}
            <Button
              type={paperSelectMode ? 'primary' : 'default'}
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => setPaperSelectMode((v) => !v)}
              style={{ borderRadius: 16 }}
            >
              {paperSelectMode ? '退出组卷' : '组卷'}
            </Button>
            <div style={{ flex: 1 }} />
            <Tooltip title="语音输入">
              <Button type="text" icon={<AudioOutlined />} style={{ color: '#8c8c8c' }} />
            </Tooltip>
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
}
