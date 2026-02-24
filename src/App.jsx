import { useState, useRef, useEffect } from 'react';
import { Input, Button, List, Spin, Empty, ConfigProvider, Select, Tooltip } from 'antd';
import { SendOutlined, PaperClipOutlined, ThunderboltOutlined, AppstoreOutlined, AudioOutlined } from '@ant-design/icons';
import { chatStream, listLLMModels, exportQuestionsDocx } from './api';
import QuestionCard from './components/QuestionCard';
import { parseGeneratedQuestion } from './utils/parseGeneratedQuestion';
import './index.css';

const { TextArea } = Input;

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [llmModels, setLLMModels] = useState([]);
  const [selectedLLM, setSelectedLLM] = useState(null);
  const [deepThink, setDeepThink] = useState(false);
  const [downloadMode, setDownloadMode] = useState(null);
  const listRef = useRef(null);

  const handleDownloadPaper = async (questions, mode = 'student') => {
    const ids = (questions || [])
      .map((q) => q.id)
      .filter((id) => id && !String(id).startsWith('generated'));
    if (!ids.length) return;
    setDownloadMode(mode);
    try {
      const blob = await exportQuestionsDocx(ids, mode);
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
  };

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

    chatStream(q, 5, selectedLLM || null, (evt) => {
      if (evt.type === 'intent') {
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
    })
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
              renderItem={(m) => (
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
                      {m.questions.map((q) => (
                        <QuestionCard key={q.id} question={q} />
                      ))}
                      {m.intent === 'assemble_paper' &&
                        m.questions.some((q) => q.id && !String(q.id).startsWith('generated')) && (
                        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          <Button
                            type="primary"
                            loading={downloadMode === 'student'}
                            onClick={() => handleDownloadPaper(m.questions, 'student')}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            下载试卷（学生版）
                          </Button>
                          <Button
                            loading={downloadMode === 'teacher'}
                            onClick={() => handleDownloadPaper(m.questions, 'teacher')}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            下载试卷（教师版）
                          </Button>
                        </div>
                      )}
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

        <div style={{
          flexShrink: 0,
          padding: '12px 16px 16px',
          borderTop: '1px solid #f0f0f0',
          background: '#fff',
        }}>
          {llmModels.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <Select
                placeholder="选择大模型"
                allowClear
                style={{ width: 160 }}
                value={selectedLLM || undefined}
                onChange={(v) => setSelectedLLM(v || null)}
                options={llmModels.map((m) => ({ label: m.name, value: m.model }))}
              />
            </div>
          )}
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
            <Tooltip title="上传文件">
              <Button type="text" icon={<PaperClipOutlined />} style={{ color: '#8c8c8c' }} />
            </Tooltip>
            <Button
              type={deepThink ? 'primary' : 'default'}
              size="small"
              icon={<ThunderboltOutlined />}
              onClick={() => setDeepThink(!deepThink)}
              style={{ borderRadius: 16 }}
            >
              深度思考
            </Button>
            <Button
              type="default"
              size="small"
              icon={<AppstoreOutlined />}
              style={{ borderRadius: 16 }}
            >
              技能
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
