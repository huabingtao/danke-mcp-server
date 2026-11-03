import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const WIKI_ROOT = path.resolve(__dirname, "../../danke-wiki");

export const VALID_DOMAINS = [
  "agents",
  "equipment-and-forge",
  "collectibles",
  "pets",
  "mounts-and-tech-parts",
  "game-modes-and-guild",
  "activity-budget-models",
  "macros-and-style-guide",
  "articles-index",
  "WIKI_PROTOCOL",
  "log",
];

/**
 * 读取 LLM Wiki 总目录 index.md 与近期演进日志 log.md
 */
export function readWikiIndex(includeLog = true) {
  const indexPath = path.join(WIKI_ROOT, "index.md");
  if (!fs.existsSync(indexPath)) {
    throw new Error(`未找到 danke-wiki/index.md (${indexPath})`);
  }
  let output = fs.readFileSync(indexPath, "utf8");

  if (includeLog) {
    const logPath = path.join(WIKI_ROOT, "log.md");
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, "utf8").split(/\r?\n/).slice(0, 45).join("\n");
      output += `\n\n---\n\n${logContent}`;
    }
  }
  return output;
}

/**
 * 读取指定领域知识文件（支持可选章节关键词过滤）
 */
export function readWikiDomain(domain, sectionKeyword = "") {
  const normalized = domain.trim().replace(/\.md$/i, "");
  let targetPath;
  if (
    normalized === "articles-index" ||
    normalized === "WIKI_PROTOCOL" ||
    normalized === "log" ||
    normalized === "index"
  ) {
    targetPath = path.join(WIKI_ROOT, `${normalized}.md`);
  } else {
    targetPath = path.join(WIKI_ROOT, "domains", `${normalized}.md`);
  }

  if (!fs.existsSync(targetPath)) {
    throw new Error(
      `未知领域 "${domain}"。可选值: ${VALID_DOMAINS.join(", ")}`
    );
  }

  const fullText = fs.readFileSync(targetPath, "utf8");
  if (!sectionKeyword || !sectionKeyword.trim()) {
    return fullText;
  }

  const kw = sectionKeyword.trim().toLowerCase();
  const sections = fullText.split(/\n(?=##\s+)/);
  const matched = sections.filter((sec) => sec.toLowerCase().includes(kw));

  if (matched.length === 0) {
    return `> 未在 ${normalized}.md 中找到包含 "${sectionKeyword}" 的独立章节，以下返回完整文件：\n\n${fullText}`;
  }

  return matched.join("\n\n---\n\n");
}

/**
 * 跨 8 大领域知识文件与 articles-index.md 检索关键词
 */
export function searchWiki(query, maxResults = 8) {
  const keywords = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (keywords.length === 0) {
    return [];
  }

  const filesToSearch = [
    ...fs
      .readdirSync(path.join(WIKI_ROOT, "domains"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        domain: f.replace(/\.md$/, ""),
        relPath: `danke-wiki/domains/${f}`,
        fullPath: path.join(WIKI_ROOT, "domains", f),
      })),
    {
      domain: "articles-index",
      relPath: "danke-wiki/articles-index.md",
      fullPath: path.join(WIKI_ROOT, "articles-index.md"),
    },
  ];

  const hits = [];

  for (const fileInfo of filesToSearch) {
    if (!fs.existsSync(fileInfo.fullPath)) continue;
    const raw = fs.readFileSync(fileInfo.fullPath, "utf8");
    const sections = raw.split(/\n(?=##\s+|###\s+)/);

    for (const sec of sections) {
      const lower = sec.toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          // 标题命中加权更高
          const firstLine = sec.split(/\r?\n/)[0].toLowerCase();
          score += firstLine.includes(kw) ? 5 : 2;
        }
      }
      if (score > 0) {
        const headingLine = sec.split(/\r?\n/)[0].replace(/^#+\s*/, "").trim();
        hits.push({
          domain: fileInfo.domain,
          sourceFile: fileInfo.relPath,
          heading: headingLine,
          score,
          excerpt: sec.trim().slice(0, 1800),
        });
      }
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, maxResults);
}
