import React, { useState, useRef, useEffect, useMemo } from 'react';
import { courses, labelOf } from './content.js';
import { Md, QuestionCard, stemText } from './components.jsx';
import { useWrongSet, removeEntry, clearCourse } from './store.js';

// 为一道题构造稳定 id 与错题集条目（含题目快照，便于训练页直接渲染、且部署后自包含）。
function makeEntry(course, doc, sec, q, i) {
  return {
    id: `${course.dir}::${doc.filename}::${sec.id}::${i}`,
    type: sec.type,
    q,
    course: course.label,
    courseDir: course.dir,
    doc: labelOf(doc.filename),
    section: sec.heading,
  };
}

function Section({ course, doc, sec, revealAll }) {
  if (sec.type === 'markdown') {
    return (
      <section className="md-section">
        <h2 className="sec-h" id={sec.id}>{sec.heading}</h2>
        <div dangerouslySetInnerHTML={{ __html: sec.html }} />
      </section>
    );
  }
  return (
    <section className="q-section">
      <h2 className="sec-h" id={sec.id}>
        {sec.heading} <span className="count">{sec.items.length} 题</span>
      </h2>
      <div className="q-list">
        {sec.items.map((q, i) => (
          <QuestionCard key={i} entry={makeEntry(course, doc, sec, q, i)} reveal={revealAll} />
        ))}
      </div>
    </section>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function App() {
  const [view, setView] = useState('doc'); // 'doc' | 'train' | 'manage'
  const [courseIdx, setCourseIdx] = useState(0);
  const [docIdx, setDocIdx] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [revealAll, setRevealAll] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [trainSeed, setTrainSeed] = useState(0);
  const contentRef = useRef(null);

  const wrongSet = useWrongSet();

  if (!courses.length) {
    return (
      <div className="empty">
        没有找到任何课程。请在项目的 <code>courses/</code> 文件夹下，
        为每门课建一个子文件夹，并放入符合格式的 <code>.md</code> 文件。
      </div>
    );
  }

  const course = courses[courseIdx];
  const doc = course.docs[docIdx];

  // 错题集按课程隔离：只看 / 只练 / 只清空当前课程的错题，切课程会跟着变化。
  const courseWrongSet = useMemo(
    () => wrongSet.filter((e) => e.courseDir === course.dir),
    [wrongSet, course.dir]
  );

  // 滚动联动（仅文档视图）：高亮左侧对应小标题。
  useEffect(() => {
    if (view !== 'doc') return;
    const root = contentRef.current;
    if (!root) return;
    const targets = [...root.querySelectorAll('[id^="sec-"]')];
    if (!targets.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting);
        if (!vis.length) return;
        vis.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        setActiveId(vis[0].target.id);
      },
      { rootMargin: '-80px 0px -68% 0px', threshold: 0 }
    );
    targets.forEach((t) => obs.observe(t));
    return () => obs.disconnect();
  }, [view, courseIdx, docIdx, resetKey]);

  function resetReveal() {
    setRevealAll(false);
    setResetKey((k) => k + 1);
    setNavOpen(false);
  }
  function selectCourse(i) {
    setCourseIdx(i);
    setDocIdx(0);
    setView('doc');
    setActiveId(null);
    resetReveal();
  }
  function selectDoc(i) {
    setDocIdx(i);
    setView('doc');
    setActiveId(null);
    resetReveal();
  }
  function openTrain() {
    setView('train');
    setTrainSeed((s) => s + 1);
    resetReveal();
  }
  function openManage() {
    setView('manage');
    resetReveal();
  }
  function jump(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
    setNavOpen(false);
  }

  return (
    <div className="app">
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="brand">
          复习备考
          <small>多课程 · 交互题库</small>
        </div>

        {/* 错题集入口（按当前课程隔离） */}
        <div className="nav-group">错题集 · {course.label}</div>
        <div className="wrong-entry">
          <button
            className={view === 'train' ? 'nav-item active' : 'nav-item'}
            onClick={openTrain}
            disabled={courseWrongSet.length === 0}
          >
            🎯 错题训练（乱序）<span className="ncnt">{courseWrongSet.length}</span>
          </button>
          <button
            className={view === 'manage' ? 'nav-item active' : 'nav-item'}
            onClick={openManage}
          >
            🗂 错题管理
          </button>
        </div>

        {/* 课程切换 */}
        <div className="nav-group">课程</div>
        <div className="course-switch">
          <select value={courseIdx} onChange={(e) => selectCourse(Number(e.target.value))}>
            {courses.map((c, i) => (
              <option key={c.dir} value={i}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* 文档列表 + 分级小标题导航 */}
        <nav className="doc-nav">
          {course.docs.map((d, i) => {
            const active = view === 'doc' && i === docIdx;
            return (
              <div key={d.filename} className="nav-block">
                <button
                  className={active ? 'nav-item active' : 'nav-item'}
                  onClick={() => selectDoc(i)}
                >
                  {labelOf(d.filename)}
                </button>
                {active && d.toc.length > 0 && (
                  <div className="nav-sub">
                    {d.toc.map((t) => (
                      <button
                        key={t.id}
                        className={`nav-subitem lv-${t.level}` + (activeId === t.id ? ' reading' : '')}
                        onClick={() => jump(t.id)}
                      >
                        {t.text}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="content" ref={contentRef} key={`${view}-${courseIdx}-${docIdx}-${resetKey}`}>
        <button className="nav-toggle" onClick={() => setNavOpen((v) => !v)}>☰ 目录</button>

        {view === 'doc' && (
          <DocView doc={doc} course={course} revealAll={revealAll} setRevealAll={setRevealAll} resetReveal={resetReveal} />
        )}
        {view === 'train' && (
          <TrainView wrongSet={courseWrongSet} course={course} trainSeed={trainSeed} revealAll={revealAll} setRevealAll={setRevealAll}
            resetReveal={resetReveal} reshuffle={() => setTrainSeed((s) => s + 1)} goManage={openManage} />
        )}
        {view === 'manage' && (
          <ManageView wrongSet={courseWrongSet} course={course} onTrain={openTrain} />
        )}
      </main>
    </div>
  );
}

function DocView({ doc, course, revealAll, setRevealAll, resetReveal }) {
  return (
    <div className="doc-main">
      <header className="doc-header">
        <h1>{doc.title}</h1>
        {doc.intro && <Md className="intro" text={doc.intro} />}
        <div className="toolbar">
          <button onClick={() => setRevealAll(true)}>显示全部答案</button>
          <button onClick={resetReveal}>重置本页作答</button>
        </div>
      </header>
      <div className="doc-body">
        {doc.sections.map((sec) => (
          <Section key={sec.id} course={course} doc={doc} sec={sec} revealAll={revealAll} />
        ))}
      </div>
      <footer className="foot">— 本资料用于个人复习备考 —</footer>
    </div>
  );
}

function TrainView({ wrongSet, course, trainSeed, revealAll, setRevealAll, resetReveal, reshuffle, goManage }) {
  // 每次进入（trainSeed 变化）重新乱序；训练中移除的题实时过滤掉。
  // 错题集按课程隔离：这里只训练当前课程的错题。
  const shuffled = useMemo(() => shuffle(wrongSet), [trainSeed]);
  const ids = new Set(wrongSet.map((e) => e.id));
  const order = shuffled.filter((e) => ids.has(e.id));

  if (wrongSet.length === 0) {
    return (
      <div className="doc-main">
        <header className="doc-header"><h1>错题训练 · {course.label}</h1></header>
        <div className="empty">
          「{course.label}」的错题集还是空的。去本课程题目卡片右上角点「☆ 加入错题集」，
          做错或想强化的题就会收集到这里（错题集按课程分开，不会混到其他课）。
        </div>
      </div>
    );
  }

  return (
    <div className="doc-main">
      <header className="doc-header">
        <h1>错题训练 · {course.label} <span className="count">{order.length} 题 · 已乱序</span></h1>
        <div className="toolbar">
          <button onClick={reshuffle}>重新乱序</button>
          <button onClick={() => setRevealAll(true)}>显示全部答案</button>
          <button onClick={resetReveal}>重置作答</button>
          <button onClick={goManage}>管理错题集</button>
        </div>
      </header>
      <div className="doc-body">
        <div className="q-list">
          {order.map((entry) => (
            <div key={entry.id} className="train-item">
              <div className="train-src">{entry.doc} · {entry.section}</div>
              <QuestionCard entry={entry} reveal={revealAll} />
            </div>
          ))}
        </div>
      </div>
      <footer className="foot">— 熟练掌握后，可在题卡右上角点「★」移出，或到「错题管理」删除 —</footer>
    </div>
  );
}

function ManageView({ wrongSet, course, onTrain }) {
  // 错题集按课程隔离，这里只展示当前课程的错题，按所属文档分组。
  const groups = useMemo(() => {
    const m = new Map();
    for (const e of wrongSet) {
      if (!m.has(e.doc)) m.set(e.doc, []);
      m.get(e.doc).push(e);
    }
    return [...m.entries()];
  }, [wrongSet]);

  return (
    <div className="doc-main">
      <header className="doc-header">
        <h1>错题管理 <span className="count">{course.label} · {wrongSet.length} 题</span></h1>
        <div className="toolbar">
          <button onClick={onTrain} disabled={wrongSet.length === 0}>开始训练</button>
          <button
            className="danger"
            disabled={wrongSet.length === 0}
            onClick={() => { if (confirm(`确定清空「${course.label}」的全部错题吗？此操作不可撤销。`)) clearCourse(course.dir); }}
          >
            清空本课程错题
          </button>
        </div>
      </header>

      {wrongSet.length === 0 ? (
        <div className="empty">「{course.label}」的错题集为空。在题目卡片右上角点「☆ 加入错题集」即可收集。</div>
      ) : (
        <div className="manage-list">
          {groups.map(([docLabel, items]) => (
            <div key={docLabel} className="manage-group">
              <h2 className="sec-h">{docLabel} <span className="count">{items.length} 题</span></h2>
              {items.map((e) => (
                <div key={e.id} className="manage-row">
                  <div className="manage-meta">
                    <span className="manage-src">{e.section}</span>
                    <div className="manage-stem">{stemText(e) || '（题目）'}</div>
                  </div>
                  <button className="manage-del" onClick={() => removeEntry(e.id)} title="删除这道错题">
                    删除
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
