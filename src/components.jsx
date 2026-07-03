import React, { useState } from 'react';
import { marked } from './md.js';
import { useIsMarked, toggleEntry } from './store.js';

export function Md({ text, inline = false, className }) {
  const html = inline ? marked.parseInline(text || '') : marked.parse(text || '');
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Feedback({ right, answer, explain, rightText, wrongText }) {
  return (
    <div className="q-feedback">
      {right !== null && (
        <span className={right ? 'tag-right' : 'tag-wrong'}>
          {right ? rightText || '回答正确' : wrongText || '回答错误'}
        </span>
      )}
      <span className="ans-line">
        正确答案：<b>{answer}</b>
      </span>
      {explain && (
        <div className="explain">
          <b>解析：</b>
          <Md inline text={explain} />
        </div>
      )}
    </div>
  );
}

// ---------------- 判断题 ----------------
function Judgment({ q, reveal }) {
  const [sel, setSel] = useState(null);
  const shown = reveal || sel !== null;
  return (
    <div className="q judgment">
      <div className="q-stem">
        <span className="q-num">{q.num}.</span> <Md inline text={q.stem} />
      </div>
      <div className="q-actions">
        {['√', '×'].map((v) => {
          let cls = 'opt-btn';
          if (sel === v) cls += ' picked';
          if (shown && q.answer === v) cls += ' correct';
          return (
            <button key={v} className={cls} onClick={() => !reveal && setSel(v)}>
              {v === '√' ? '√ 正确' : '× 错误'}
            </button>
          );
        })}
      </div>
      {shown && (
        <Feedback right={sel === null ? null : sel === q.answer} answer={q.answer} explain={q.explain} />
      )}
    </div>
  );
}

// ---------------- 选择题（单选 / 多选 / 不定项） ----------------
function Choice({ q, reveal }) {
  const [sel, setSel] = useState(() => new Set());
  const [submitted, setSubmitted] = useState(false);
  const shown = reveal || submitted;
  const ansSet = new Set(q.answer.split(''));
  const right = shown && sel.size === ansSet.size && [...sel].every((l) => ansSet.has(l));

  function toggle(l) {
    if (shown) return;
    const next = new Set(sel);
    if (q.multi) {
      next.has(l) ? next.delete(l) : next.add(l);
    } else {
      next.clear();
      next.add(l);
    }
    setSel(next);
  }

  return (
    <div className="q choice">
      <div className="q-stem">
        <span className="q-num">{q.num}.</span> <Md inline text={q.stem} />
        <span className="q-tag">{q.multi ? '多选' : '单选'}</span>
      </div>
      <div className="options">
        {q.options.map((o) => {
          const picked = sel.has(o.label);
          const isAns = ansSet.has(o.label);
          let cls = 'option';
          if (picked) cls += ' picked';
          if (shown && isAns) cls += ' correct';
          if (shown && picked && !isAns) cls += ' incorrect';
          return (
            <div key={o.label} className={cls} onClick={() => toggle(o.label)}>
              <span className="box">{picked ? (q.multi ? '☑' : '◉') : q.multi ? '☐' : '○'}</span>
              <span className="opt-label">{o.label}</span>
              <span className="opt-text"><Md inline text={o.text} /></span>
            </div>
          );
        })}
      </div>
      {!shown && (
        <button className="submit-btn" disabled={sel.size === 0} onClick={() => setSubmitted(true)}>
          提交
        </button>
      )}
      {shown && (
        <Feedback
          right={submitted ? right : null}
          answer={q.answer}
          explain={q.explain}
          wrongText={q.multi ? '回答错误（多选/少选均不得分）' : '回答错误'}
        />
      )}
    </div>
  );
}

// ---------------- 填空题 ----------------
function Fill({ q, reveal }) {
  const [vals, setVals] = useState(() => Array(q.blanks).fill(''));
  const [submitted, setSubmitted] = useState(false);
  const shown = reveal || submitted;

  const norm = (s) => (s || '').trim().toLowerCase();
  const eachRight = vals.map((v, i) => norm(v) === norm(q.answers[i]));
  const allRight = eachRight.every(Boolean) && vals.length === q.answers.length;

  // 把题干按 ____ 切开，空位处插入输入框
  const parts = q.stem.split(/_{2,}/);

  return (
    <div className="q fill">
      <div className="q-stem">
        <span className="q-num">{q.num}.</span>{' '}
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            <Md inline text={p} />
            {i < parts.length - 1 && (
              <input
                className={
                  'blank-input' +
                  (shown ? (eachRight[i] ? ' ok' : ' bad') : '')
                }
                value={vals[i] || ''}
                disabled={shown}
                onChange={(e) => {
                  const next = [...vals];
                  next[i] = e.target.value;
                  setVals(next);
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      {!shown && (
        <button
          className="submit-btn"
          disabled={vals.every((v) => v.trim() === '')}
          onClick={() => setSubmitted(true)}
        >
          提交
        </button>
      )}
      {shown && (
        <Feedback
          right={submitted ? allRight : null}
          answer={q.answers.join('　/　')}
          explain={q.explain}
        />
      )}
    </div>
  );
}

// ---------------- 主观题（名词解释 / 简答 / 论述） ----------------
function Subjective({ q, reveal }) {
  const [val, setVal] = useState('');
  const [show, setShow] = useState(false);
  const shown = reveal || show;
  return (
    <div className="q subjective">
      <div className="q-stem"><Md inline text={q.title} /></div>
      <textarea
        className="answer-input"
        placeholder="在此作答，然后点击下方按钮对照参考答案……"
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      {!shown && (
        <button className="submit-btn" onClick={() => setShow(true)}>显示参考答案</button>
      )}
      {shown && (
        <div className="ref-answer">
          <div className="ref-head">参考答案</div>
          <Md text={q.answerMd} />
        </div>
      )}
    </div>
  );
}

// type → 渲染组件。新增题型时在此登记同名组件。
export const RENDERERS = {
  judgment: Judgment,
  choice: Choice,
  fill: Fill,
  subjective: Subjective,
};

// 错题集开关：所有交互题型通用，悬浮在题卡右上角。
export function WrongToggle({ entry }) {
  const marked = useIsMarked(entry.id);
  return (
    <button
      className={'wrong-toggle' + (marked ? ' on' : '')}
      onClick={() => toggleEntry(entry)}
      title={marked ? '移出错题集' : '加入错题集'}
    >
      {marked ? '★ 已在错题集' : '☆ 加入错题集'}
    </button>
  );
}

// 题卡外壳：渲染对应题型组件 + 错题集开关。
export function QuestionCard({ entry, reveal }) {
  const Comp = RENDERERS[entry.type];
  if (!Comp) return null;
  return (
    <div className="q-shell">
      <WrongToggle entry={entry} />
      <Comp q={entry.q} reveal={reveal} />
    </div>
  );
}

// 取一道题的纯文本简述（错题集管理列表用）。
export function stemText(entry) {
  const q = entry.q || {};
  const raw = q.stem || q.title || '';
  return raw.replace(/[*`_]/g, '').replace(/（____）/g, '（ ____ ）').trim();
}
