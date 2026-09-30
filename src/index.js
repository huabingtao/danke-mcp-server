#!/usr/bin/env node
/**
 * danke-mcp-server 入口文件 (Stdio 模式)
 * 
 * 作用：作为 AI 大脑与 danke-core 数据中心之间的“标准转接头” (MCP Server)
 * 运行机制：通过 Stdio (标准输入输出) 监听来自大模型客户端的 JSON-RPC 消息
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DankeApiClient } from "./client.js";

// 1. 初始化通信客户端
const client = new DankeApiClient();

// 2. 创建 MCP Server 实例
const server = new McpServer({
  name: "danke-mcp-server",
  version: "1.0.0",
  description: "弹壳特攻队资产中台与自媒体运营 MCP 插件服务",
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
