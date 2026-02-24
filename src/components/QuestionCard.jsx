import { useState } from 'react';
import { Card, Tag, Checkbox } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function ContentBlock({ block, assetBaseUrl = '' }) {
  if (!block) return null;
  if (block.type === 'text') {
    const content = block.content || '';
    return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</span>;
  }
  if (block.type === 'latex' && block.content) {
    try {
      const html = katex.renderToString(block.content, {
        throwOnError: false,
        displayMode: false,
        errorColor: '#cc0000',
        strict: false,
      });
      return (
        <span className="content-latex-wrap" style={{ display: 'inline-block', maxWidth: '100%', verticalAlign: 'middle', margin: '0 0.1em' }}>
          <span className="content-latex" style={{ fontSize: '1.05em' }} dangerouslySetInnerHTML={{ __html: html }} />
        </span>
      );
    } catch {
      return <span>{block.content}</span>;
    }
  }
  if (block.type === 'image' || block.type === 'svg') {
    const rawUrl = (block.url || '').trim();
    const src = rawUrl.startsWith('http') ? rawUrl : (assetBaseUrl ? `${assetBaseUrl}${rawUrl}` : rawUrl);
    const w = block.width;
    const h = block.height;
    const imgStyle = {
      maxWidth: 240,
      maxHeight: 120,
      width: typeof w === 'number' && w > 0 ? w : undefined,
      height: typeof h === 'number' && h > 0 ? h : undefined,
      objectFit: 'contain',
      verticalAlign: 'middle',
      margin: '0 0.2em',
    };
    return <span style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}><img src={src} alt="" style={imgStyle} /></span>;
  }
  return null;
}

export default function QuestionCard({ question, selectable = false, checked = false, onCheckChange, cardKey }) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const {
    description,
    difficulty,
    categories,
    questionBody = [],
    answer = [],
    analysis = [],
    questionType,
    score,
  } = question;
  const typeMap = { single_choice: '单选', multiple_choice: '多选', fill_blank: '填空', solution: '解答' };

  const renderBlocks = (blocks, assetBaseUrl) => (
    <div style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
      {blocks.map((b, i) => (
        <ContentBlock key={i} block={b} assetBaseUrl={assetBaseUrl} />
      ))}
    </div>
  );

  const hasAnswer = answer.length > 0;
  const hasAnalysis = analysis.length > 0;

  const cardContent = (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        position: 'relative',
        paddingTop: selectable ? 28 : undefined,
      }}
    >
      {selectable && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1 }}>
          <Checkbox
            checked={checked}
            onChange={(e) => onCheckChange?.(e.target.checked, cardKey)}
          />
        </div>
      )}
      <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {typeof score === 'number' && (
          <Tag color="green">相关度 {score} 分</Tag>
        )}
        {difficulty && <Tag>{difficulty}</Tag>}
        {questionType && <Tag color="blue">{typeMap[questionType] || questionType}</Tag>}
        {(categories || []).map((c) => (
          <Tag key={c}>{c}</Tag>
        ))}
      </div>
      {description && <p style={{ color: '#666', marginBottom: 8 }}>{description}</p>}
      {questionBody.length > 0 && renderBlocks(questionBody, question.assetBaseUrl)}
      {hasAnswer && (
        <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setAnswerOpen((o) => !o)}
            onKeyDown={(e) => e.key === 'Enter' && setAnswerOpen((o) => !o)}
            style={{
              color: '#52c41a',
              fontWeight: 500,
              marginBottom: answerOpen ? 6 : 0,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {answerOpen ? <DownOutlined /> : <RightOutlined />}
            【答案】
          </div>
          {answerOpen && renderBlocks(answer, question.assetBaseUrl)}
        </div>
      )}
      {hasAnalysis && (
        <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setAnalysisOpen((o) => !o)}
            onKeyDown={(e) => e.key === 'Enter' && setAnalysisOpen((o) => !o)}
            style={{
              color: '#1890ff',
              fontWeight: 500,
              marginBottom: analysisOpen ? 6 : 0,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {analysisOpen ? <DownOutlined /> : <RightOutlined />}
            【解析】
          </div>
          {analysisOpen && renderBlocks(analysis, question.assetBaseUrl)}
        </div>
      )}
    </Card>
  );

  if (selectable) {
    return (
      <div
        style={{
          marginBottom: 12,
          borderRadius: 8,
          background: checked ? 'rgba(79, 70, 229, 0.06)' : 'transparent',
          border: checked ? '1px solid rgba(79, 70, 229, 0.3)' : '1px solid transparent',
          padding: 4,
        }}
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
}
