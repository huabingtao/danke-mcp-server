#!/usr/bin/env node
/**
 * danke-mcp-server 入口文件 (Stdio 模式)
 * 
 * 作用：作为 AI 大脑与 danke-core 数据中心 + danke-wiki 大模型知识库之间的“标准转接头” (MCP Server)
 * 运行机制：通过 Stdio (标准输入输出) 监听来自大模型客户端的 JSON-RPC 消息
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DankeApiClient } from "./client.js";
import {
  VALID_DOMAINS,
  readWikiIndex,
  readWikiDomain,
  searchWiki,
} from "./wiki.js";

// 1. 初始化通信客户端
const client = new DankeApiClient();

// 2. 创建 MCP Server 实例
const server = new McpServer({
  name: "danke-mcp-server",
  version: "1.1.0",
  description: "弹壳特攻队 LLM Wiki 知识库、资产中台与自媒体运营 MCP 插件服务",
});

/**
 * 🛠️ 工具 1：get_reminder_rules
 * 作用：查询当前所有生效的活动周期规则、每日倒计时和打卡提醒
 * 典型应用：写公众号日历提醒、活动截止倒计时攻略
 */
server.tool(
  "get_reminder_rules",
  "获取《弹壳特攻队》当前生效的活动周期、剩余天数倒计时和打卡提醒（如日常挑战、区域行动、公会探索、逃离行动等）",
  {
    onlyDigest: z
      .boolean()
      .optional()
      .default(true)
      .describe("是否返回已计算好的今日倒计时简报（包含各活动还剩几天、打卡建议，最适合文案排版）"),
    date: z
      .string()
      .optional()
      .describe("指定计算日期，格式 YYYY-MM-DD，不传默认取当前系统日期"),
  },
  async ({ onlyDigest, date }) => {
    try {
      if (onlyDigest) {
        const digest = await client.getReminderDailyDigest(date);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(digest, null, 2),
            },
          ],
        };
      }

      const rules = await client.getReminders();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rules, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `[获取提醒规则失败]: ${error.message}。请检查 danke-core (localhost:3000) 是否已启动。`,
          },
        ],
      };
    }
  }
);

/**
 * 🛠️ 工具 2：get_monthly_yields
 * 作用：查询指定年份和月份的游戏资产产出统计（如钥匙、特工碎片、S装备、核心等）
 * 典型应用：回答用户“某个月能产出多少把钥匙”、“哪种途径产出最多”
 */
server.tool(
  "get_monthly_yields",
  "查询《弹壳特攻队》指定年月的游戏道具产出总账报表（如钥匙、碎片、核心、自选装备等），支持按道具名称模糊筛选",
  {
    year: z
      .number()
      .describe("查询年份，例如 2026"),
    month: z
      .number()
      .min(1)
      .max(12)
      .describe("查询月份，数值 1-12"),
    itemName: z
      .string()
      .optional()
      .describe("可选：按道具名称模糊过滤（例如输入'钥匙'、'碎片'、'史诗配件'）。不传则返回当月全部道具汇总"),
  },
  async ({ year, month, itemName }) => {
    try {
      const report = await client.getMonthlyReport(year, month);
      
      // 如果指定了道具名称关键词，进行本地过滤与统计
      if (itemName && Array.isArray(report.rows)) {
        const keyword = itemName.trim().toLowerCase();
        const matchedRows = report.rows.filter(
          (row) =>
            row.name.toLowerCase().includes(keyword) ||
            (keyword.includes("钥匙") && row.type === "KEY")
        );

        const summary = {
          year,
          month,
          filterKeyword: itemName,
          matchCount: matchedRows.length,
          totalYield: matchedRows.reduce((sum, r) => sum + (r.total || 0), 0),
          items: matchedRows.map((r) => ({
            name: r.name,
            type: r.type,
            monthlyTotal: r.total,
            sourcesBreakdown: r.yields,
          })),
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      // 未传关键词则返回原始完整报表
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(report, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `[获取月度收益失败]: ${error.message}。请检查 danke-core (localhost:3000) 是否正常运行。`,
          },
        ],
      };
    }
  }
);

/**
 * 🛠️ 工具 3：get_wiki_index
 * 作用：读取《弹壳特攻队》LLM Wiki 总目录 (index.md) 与最近演进日志 (log.md)
 * 典型应用：大模型回答任何弹壳特攻队机制问题或写攻略前的第一跳路由检索
 */
server.tool(
  "get_wiki_index",
  "读取《弹壳特攻队》LLM Wiki 知识库总目录 (danke-wiki/index.md) 与更新日志 (log.md)，获取 8 大领域知识库路由指南",
  {
    includeLog: z
      .boolean()
      .optional()
      .default(true)
      .describe("是否附带返回 log.md 中的最近知识库演进记录"),
  },
  async ({ includeLog }) => {
    try {
      const text = readWikiIndex(includeLog);
      return {
        content: [{ type: "text", text }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `[读取 Wiki 索引失败]: ${error.message}` }],
      };
    }
  }
);

/**
 * 🛠️ 工具 4：get_wiki_domain
 * 作用：按领域名读取高密度编译后的 Markdown 知识文件
 */
server.tool(
  "get_wiki_domain",
  "按领域读取《弹壳特攻队》LLM Wiki 的高密度知识库文件（如 agents, equipment-and-forge, collectibles, pets, mounts-and-tech-parts, game-modes-and-guild, activity-budget-models, macros-and-style-guide, articles-index）",
  {
    domain: z
      .enum(VALID_DOMAINS)
      .describe("要读取的领域知识库名称"),
    sectionKeyword: z
      .string()
      .optional()
      .describe("可选：按章节关键词过滤（如 '844'、'神炼'、'潮汐秘境'），不传则返回该领域完整文档"),
  },
  async ({ domain, sectionKeyword }) => {
    try {
      const text = readWikiDomain(domain, sectionKeyword);
      return {
        content: [{ type: "text", text }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `[读取领域知识库失败]: ${error.message}` }],
      };
    }
  }
);

/**
 * 🛠️ 工具 5：search_danke_wiki
 * 作用：跨所有领域知识库与 200+ 篇原始攻略索引检索关键词
 */
server.tool(
  "search_danke_wiki",
  "在《弹壳特攻队》LLM Wiki 全部 8 大领域知识库与原始攻略索引中全文搜索关键词（如 '伊狑844'、'月殇护手'、'25黄星'、'谐振芯片'、'卡5分38秒'）",
  {
    query: z
      .string()
      .min(1)
      .describe("搜索关键词（多个词用空格分隔）"),
    maxResults: z
      .number()
      .min(1)
      .max(20)
      .optional()
      .default(6)
      .describe("返回的最大匹配段落数，默认 6"),
  },
  async ({ query, maxResults }) => {
    try {
      const hits = searchWiki(query, maxResults);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query,
                hitCount: hits.length,
                results: hits,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: `[搜索 Wiki 失败]: ${error.message}` }],
      };
    }
  }
);

// 3. 启动 Stdio 传输通道
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 danke-mcp-server (Stdio) 已成功启动，等待大模型客户端指令...");
}

main().catch((err) => {
  console.error("❌ MCP Server 启动异常:", err);
  process.exit(1);
});
