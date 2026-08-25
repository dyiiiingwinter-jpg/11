"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MATERIALS, type Material } from "./materials-data";

type JobVersion = {
  id: string;
  company: string;
  role: string;
  jd: string;
  createdAt: string;
  selected: string[];
  drafts: Record<string, string>;
  summary: string;
};

type ScoredMaterial = Material & { score: number; hits: string[] };

const BAIDU_JD = `工作职责：
负责品牌内容、产品传播的内容策划与撰写，包括新媒体文案、公关稿、活动文案等
深入理解品牌调性与用户洞察，产出有传播力的内容
与设计、运营、公关团队协作，推动内容方案落地
跟踪内容传播效果，持续优化内容策略
善用AI辅助写作工具提升内容创作效率

职责要求：
本科及以上学历，新闻传播、中文、市场营销等相关专业优先
文字功底扎实，有良好的内容感知与创意能力
有较强的信息检索与内容整合能力
有新媒体内容创作或品牌传播相关实习经历者优先`;

const TERM_GROUPS: Record<string, string[]> = {
  内容策划: ["内容策划", "内容创作", "文案", "撰写", "内容感知"],
  品牌传播: ["品牌", "传播", "公关", "调性", "产品传播"],
  新媒体: ["新媒体", "短视频", "社媒", "公众号", "小红书", "KOL", "KOC"],
  用户洞察: ["用户洞察", "用户研究", "人群", "TA", "需求"],
  活动运营: ["活动", "运营", "社群", "落地", "策划"],
  数据复盘: ["传播效果", "数据", "复盘", "优化", "转化"],
  跨团队协作: ["协作", "跨团队", "设计", "运营", "公关", "沟通"],
  信息整合: ["信息检索", "内容整合", "研究", "资料", "框架"],
  AI写作: ["AI", "ChatGPT", "人工智能", "辅助写作"],
};

const PROFILE = {
  name: "代盈盈",
  phone: "18216688686",
  email: "Daingng@163.com",
  location: "北京",
  summary:
    "中国政法大学硕士在读，具备品牌内容、新媒体传播与用户洞察实践。能够从人群研究与产品卖点出发完成选题策划、文案审核、活动落地及传播复盘，并使用 AI 工具辅助检索、构思与表达优化。",
};

const STORE_KEY = "resume-studio-cn-v3";

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, "");
}

function detectTerms(jd: string) {
  const normalized = normalize(jd);
  return Object.entries(TERM_GROUPS)
    .filter(([, aliases]) => aliases.some((term) => normalized.includes(normalize(term))))
    .map(([label]) => label);
}

function scoreMaterial(material: Material, terms: string[], jd: string): ScoredMaterial {
  const haystack = normalize(
    `${material.theme}${material.keywords}${material.targetRoles}${material.polished}${material.role}${material.organization}`,
  );
  const hits = terms.filter((label) =>
    TERM_GROUPS[label].some((alias) => haystack.includes(normalize(alias))),
  );
  const directWords = jd
    .split(/[，。、；：\s/]+/)
    .filter((word) => word.length >= 2 && word.length <= 8)
    .filter((word) => haystack.includes(normalize(word)));
  const contentBonus = /内容|品牌|新媒体|传播|文案|活动|用户/.test(haystack) ? 10 : 0;
  const evidenceBonus = material.evidence ? 8 : 0;
  const score = Math.min(99, hits.length * 12 + Math.min(18, directWords.length * 3) + contentBonus + evidenceBonus);
  return { ...material, score, hits: [...new Set([...hits, ...directWords.slice(0, 3)])] };
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function download(name: string, content: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [company, setCompany] = useState("百度");
  const [role, setRole] = useState("内容策划");
  const [jd, setJd] = useState(BAIDU_JD);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"match" | "rewrite" | "preview">("match");
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [versions, setVersions] = useState<JobVersion[]>([]);
  const [notice, setNotice] = useState("素材库已同步");
  const [showHistory, setShowHistory] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const terms = useMemo(() => detectTerms(jd), [jd]);
  const scored = useMemo(
    () => MATERIALS.filter((item) => item.enabled)
      .map((item) => scoreMaterial(item, terms, jd))
      .sort((a, b) => b.score - a.score),
    [jd, terms],
  );
  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return scored;
    return scored.filter((item) =>
      normalize(`${item.organization}${item.role}${item.theme}${item.keywords}${item.polished}`).includes(needle),
    );
  }, [query, scored]);
  const top = scored.slice(0, 8);
  const selectedMaterials = scored.filter((item) => selected.includes(item.id));
  const matchRate = Math.min(96, 38 + terms.length * 5 + Math.min(18, selectedMaterials.length * 2));
  const covered = [...new Set(selectedMaterials.flatMap((item) => item.hits).filter((x) => terms.includes(x)))];
  const missing = terms.filter((term) => !covered.includes(term));

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        if (Array.isArray(state.versions)) setVersions(state.versions);
        if (state.draft && typeof state.draft === "object") {
          setCompany(state.draft.company || "百度");
          setRole(state.draft.role || "内容策划");
          setJd(state.draft.jd || BAIDU_JD);
          setSelected(state.draft.selected || []);
          setDrafts(state.draft.drafts || {});
        }
      }
    } catch {
      setNotice("本地记录读取失败，可导入备份恢复");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ versions, draft: { company, role, jd, selected, drafts } }),
    );
  }, [company, drafts, hydrated, jd, role, selected, versions]);

  useEffect(() => {
    if (!hydrated || selected.length) return;
    const defaults = top.filter((item) => item.score >= 28).slice(0, 6).map((item) => item.id);
    setSelected(defaults);
    setDrafts(Object.fromEntries(top.map((item) => [item.id, item.polished])));
  }, [hydrated, selected.length, top]);

  const selectRecommended = () => {
    const ids = top.filter((item) => item.score >= 28).slice(0, 7).map((item) => item.id);
    setSelected(ids);
    setDrafts((old) => ({ ...Object.fromEntries(top.map((item) => [item.id, item.polished])), ...old }));
    setNotice(`已选择 ${ids.length} 条高匹配素材`);
  };

  const toggleMaterial = (item: ScoredMaterial) => {
    setSelected((old) => old.includes(item.id) ? old.filter((id) => id !== item.id) : [...old, item.id]);
    setDrafts((old) => ({ ...old, [item.id]: old[item.id] || item.polished }));
  };

  const saveVersion = () => {
    const next: JobVersion = {
      id: crypto.randomUUID(),
      company,
      role,
      jd,
      createdAt: new Date().toISOString(),
      selected,
      drafts,
      summary: PROFILE.summary,
    };
    setVersions((old) => [next, ...old].slice(0, 30));
    setNotice(`“${company} · ${role}”版本已保存`);
  };

  const restoreVersion = (version: JobVersion) => {
    setCompany(version.company);
    setRole(version.role);
    setJd(version.jd);
    setSelected(version.selected);
    setDrafts(version.drafts);
    setShowHistory(false);
    setNotice("历史版本已恢复");
  };

  const exportBackup = () => {
    download(
      `履历工坊-备份-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), versions, draft: { company, role, jd, selected, drafts } }, null, 2),
      "application/json;charset=utf-8",
    );
    setNotice("备份已下载");
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.versions)) throw new Error("bad format");
      setVersions(data.versions);
      if (data.draft) {
        setCompany(data.draft.company || "");
        setRole(data.draft.role || "");
        setJd(data.draft.jd || "");
        setSelected(data.draft.selected || []);
        setDrafts(data.draft.drafts || {});
      }
      setNotice(`已导入 ${data.versions.length} 个岗位版本`);
    } catch {
      setNotice("导入失败：请选择履历工坊 JSON 备份");
    }
  };

  const exportMarkdown = () => {
    const body = `# ${PROFILE.name}｜${company}·${role}\n\n${PROFILE.phone}｜${PROFILE.email}｜${PROFILE.location}\n\n## 个人优势\n\n${PROFILE.summary}\n\n## 相关经历\n\n${selectedMaterials.map((item) => `### ${item.organization}｜${item.role}｜${item.start}—${item.end}\n\n- ${drafts[item.id] || item.polished}`).join("\n\n")}\n\n## 教育背景\n\n- 中国政法大学｜硕士｜马克思主义基本原理｜GPA 4.56，专业前 5%｜2024.09—至今\n- 中国政法大学｜本科｜思想政治教育｜GPA 4.58，专业前 15%｜2020.07—2024.09\n`;
    download(`${PROFILE.name}-${company}-${role}.md`, body, "text/markdown;charset=utf-8");
  };

  return (
    <main className="appShell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">履</span>
          <span><b>履历工坊</b><small>RESUME STUDIO</small></span>
        </div>
        <div className="topStats">
          <span><i className="statusDot" />{notice}</span>
          <span className="desktopOnly">156 条素材 · 31 段经历</span>
        </div>
        <div className="topActions">
          <button className="textButton" onClick={() => setShowHistory(true)}>版本记录 <b>{versions.length}</b></button>
          <button className="outlineButton" onClick={saveVersion}>保存本次版本</button>
        </div>
      </header>

      <section className="command">
        <div className="commandIntro">
          <p className="kicker">JD 驱动的简历定制台</p>
          <h1>每次投递，只改<strong>该改的文字。</strong></h1>
          <p>从真实经历中自动筛选证据、人工审核表达，固定版式直接预览。</p>
        </div>
        <div className="commandMetrics">
          <div><span>岗位匹配度</span><b>{matchRate}<small>%</small></b></div>
          <div><span>已选素材</span><b>{selected.length}<small>条</small></b></div>
          <div><span>量化证据</span><b>{selectedMaterials.filter((item) => item.evidence).length}<small>条</small></b></div>
        </div>
      </section>

      <section className="jobDesk">
        <div className="jobIdentity">
          <label>目标公司<input value={company} onChange={(event) => setCompany(event.target.value)} /></label>
          <span>/</span>
          <label>目标岗位<input value={role} onChange={(event) => setRole(event.target.value)} /></label>
        </div>
        <label className="jdField">
          <span>岗位描述 JD <small>粘贴后自动重新匹配</small></span>
          <textarea value={jd} onChange={(event) => setJd(event.target.value)} />
        </label>
        <aside className="analysisCard">
          <div className="analysisHead"><span>岗位能力地图</span><b>{terms.length} 项已识别</b></div>
          <div className="termCloud">
            {terms.map((term) => <span className={covered.includes(term) ? "covered" : ""} key={term}>{term}</span>)}
          </div>
          <div className="coverage">
            <span>已覆盖 {covered.length}/{terms.length}</span>
            <i><b style={{ width: `${terms.length ? (covered.length / terms.length) * 100 : 0}%` }} /></i>
          </div>
          {missing.length > 0 && <p>待补强：{missing.join("、")}</p>}
        </aside>
      </section>

      <nav className="tabs" aria-label="工作流程">
        <button className={activeTab === "match" ? "active" : ""} onClick={() => setActiveTab("match")}><span>01</span>素材匹配</button>
        <button className={activeTab === "rewrite" ? "active" : ""} onClick={() => setActiveTab("rewrite")}><span>02</span>定向改写</button>
        <button className={activeTab === "preview" ? "active" : ""} onClick={() => setActiveTab("preview")}><span>03</span>原版预览</button>
      </nav>

      {activeTab === "match" && (
        <section className="contentStage">
          <div className="sectionToolbar">
            <div><p className="kicker">EXPERIENCE EVIDENCE</p><h2>最值得写进这份简历的经历</h2></div>
            <div className="toolbarActions">
              <label className="searchBox">⌕<input placeholder="搜索组织、能力或关键词" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
              <button className="solidButton" onClick={selectRecommended}>一键选择推荐</button>
            </div>
          </div>
          <div className="materialList">
            {filtered.slice(0, query ? 40 : 18).map((item, index) => (
              <article className={`materialRow ${selected.includes(item.id) ? "selected" : ""}`} key={item.id}>
                <button className="selectBox" onClick={() => toggleMaterial(item)} aria-label="选择素材">{selected.includes(item.id) ? "✓" : ""}</button>
                <div className="rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="materialMain">
                  <div className="materialMeta">
                    <b>{item.organization}</b>
                    <span>{item.role}</span>
                    <small>{item.start} — {item.end}</small>
                  </div>
                  <p>{item.polished}</p>
                  <div className="chips">
                    {item.hits.slice(0, 4).map((hit) => <span key={hit}>{hit}</span>)}
                    {item.evidence && <span className="proof">含量化证据</span>}
                    {item.todo && <span className="todo">可补充</span>}
                  </div>
                </div>
                <div className="score"><b>{item.score}</b><span>匹配分</span></div>
              </article>
            ))}
          </div>
          <div className="stageFooter"><span>已从 156 条真实素材中排序 · 当前显示 {Math.min(filtered.length, query ? 40 : 18)} 条</span><button className="solidButton" onClick={() => setActiveTab("rewrite")}>进入定向改写 →</button></div>
        </section>
      )}

      {activeTab === "rewrite" && (
        <section className="rewriteStage">
          <div className="rewriteMain">
            <div className="sectionToolbar">
              <div><p className="kicker">HUMAN-IN-THE-LOOP</p><h2>逐条审核，事实始终可追溯</h2></div>
              <button className="outlineButton" onClick={() => setActiveTab("match")}>调整素材</button>
            </div>
            <div className="rewriteList">
              {selectedMaterials.length ? selectedMaterials.map((item, index) => (
                <article className="rewriteCard" key={item.id}>
                  <header><span>{String(index + 1).padStart(2, "0")}</span><div><b>{item.organization}</b><small>{item.role} · {item.source}</small></div><em>{item.truth}</em></header>
                  <textarea value={drafts[item.id] ?? item.polished} onChange={(event) => setDrafts((old) => ({ ...old, [item.id]: event.target.value }))} />
                  <footer>
                    <span>{(drafts[item.id] ?? item.polished).length} 字</span>
                    <span>匹配：{item.hits.slice(0, 4).join("、") || "通用能力"}</span>
                    <button onClick={() => setDrafts((old) => ({ ...old, [item.id]: item.polished }))}>恢复素材原文</button>
                  </footer>
                </article>
              )) : <div className="emptyState">还没有选中素材。<button onClick={() => setActiveTab("match")}>返回选择</button></div>}
            </div>
          </div>
          <aside className="rewriteAside">
            <div className="truthCard"><span>真实性护栏</span><b>仅使用已验证事实</b><p>数字来自原信息表；待补充项只提醒，不会写入简历。</p></div>
            <div className="fitCard"><span>本页内容预算</span><b>{selectedMaterials.reduce((sum, item) => sum + (drafts[item.id] ?? item.polished).length, 0)} 字</b><p>{selected.length > 8 ? "建议精简至 6—8 条，避免一页版式溢出。" : "当前适合一页简历，仍建议在预览页复核。"}</p></div>
            <button className="solidButton full" onClick={() => setActiveTab("preview")}>确认文案并预览 →</button>
          </aside>
        </section>
      )}

      {activeTab === "preview" && (
        <section className="previewStage">
          <div className="previewTools">
            <div><p className="kicker">FIXED LAYOUT PREVIEW</p><h2>原版式文字回填预览</h2><p>页面结构、字体层级和信息区块固定，仅替换经历文字。</p></div>
            <div className="toolStack">
              <button className="solidButton" onClick={() => window.print()}>打印 / 另存 PDF</button>
              <button className="outlineButton" onClick={exportMarkdown}>下载文字备份</button>
              <button className="textButton" onClick={() => setActiveTab("rewrite")}>返回改写</button>
            </div>
          </div>
          <ResumePaper materials={selectedMaterials} drafts={drafts} company={company} role={role} />
        </section>
      )}

      <section className="repeatBar">
        <div><b>为下一次投递做好准备</b><span>岗位版本自动保存在当前浏览器；定期下载 JSON 备份即可迁移或恢复。</span></div>
        <div><button className="textButton" onClick={() => importRef.current?.click()}>导入备份</button><button className="outlineButton" onClick={exportBackup}>下载完整备份</button></div>
        <input ref={importRef} hidden type="file" accept=".json,application/json" onChange={(event) => importBackup(event.target.files?.[0])} />
      </section>

      <footer className="siteFooter"><span>履历工坊 · 内容真实优先</span><span>内置 156 条结构化素材 · 数据默认保存在当前设备</span></footer>

      {showHistory && (
        <div className="modalBackdrop" onMouseDown={() => setShowHistory(false)}>
          <aside className="historyDrawer" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><p className="kicker">VERSION LIBRARY</p><h2>岗位版本记录</h2></div><button className="closeButton" onClick={() => setShowHistory(false)}>×</button></header>
            <div className="historyList">
              {versions.length ? versions.map((version) => (
                <article key={version.id}>
                  <div><b>{version.company}</b><span>{version.role}</span><small>{shortDate(version.createdAt)} · {version.selected.length} 条素材</small></div>
                  <button onClick={() => restoreVersion(version)}>恢复</button>
                  <button className="deleteButton" onClick={() => setVersions((old) => old.filter((item) => item.id !== version.id))}>删除</button>
                </article>
              )) : <div className="emptyState">还没有保存过岗位版本。</div>}
            </div>
            <footer><button className="outlineButton" onClick={exportBackup}>下载全部备份</button></footer>
          </aside>
        </div>
      )}
    </main>
  );
}

function ResumePaper({ materials, drafts, company, role }: { materials: ScoredMaterial[]; drafts: Record<string, string>; company: string; role: string }) {
  const grouped = materials.reduce<Record<string, ScoredMaterial[]>>((acc, item) => {
    (acc[item.experienceId] ||= []).push(item);
    return acc;
  }, {});
  return (
    <article className="resumePaper" id="resume-paper">
      <header className="resumeHeader">
        <div><h3>{PROFILE.name}</h3><p>{PROFILE.phone}　|　{PROFILE.email}　|　{PROFILE.location}</p></div>
        <span>{company}<br /><b>{role}</b></span>
      </header>
      <section><h4>教育背景</h4>
        <div className="resumeLine"><b>中国政法大学</b><strong>硕士｜马克思主义基本原理</strong><span>2024.09—至今</span></div>
        <p className="subline">GPA 4.56 / 专业前 5%</p>
        <div className="resumeLine"><b>中国政法大学</b><strong>本科｜思想政治教育</strong><span>2020.07—2024.09</span></div>
        <p className="subline">GPA 4.58 / 专业前 15%</p>
      </section>
      <section><h4>个人优势</h4><p>{PROFILE.summary}</p></section>
      <section><h4>相关经历</h4>
        {Object.values(grouped).map((items) => {
          const first = items[0];
          return <div className="resumeExperience" key={first.experienceId}>
            <div className="resumeLine"><b>{first.organization}</b><strong>{first.role}</strong><span>{first.start}—{first.end}</span></div>
            {items.map((item) => <p className="resumeBullet" key={item.id}>{drafts[item.id] ?? item.polished}</p>)}
          </div>;
        })}
      </section>
      <div className="resumePageNo">1 / 1　·　文字定制预览</div>
    </article>
  );
}
