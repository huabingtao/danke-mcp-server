import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.resolve(__dirname, "../src/index.js");

// 创建一个模拟的 AI 宿主客户端
const transport = new StdioClientTransport({
  command: "node",
  args: [serverScript],
});

const client = new Client(
  { name: "danke-test-client", version: "1.0.0" },
  { capabilities: {} }
);

async function main() {
  console.log("正在连接 danke-mcp-server (WSL)...");
  await client.connect(transport);
  console.log("✅ 成功连接！");

  // 1. 列出支持的所有工具
  const { tools } = await client.listTools();
  console.log("\n📦 当前可用工具列表：");
  tools.forEach((t) => console.log(` - 🛠️ ${t.name}: ${t.description}`));

  // 2. 模拟大模型调用工具 1：查今天活动提醒
  console.log("\n-------------------------------------------");
  console.log("🤖 模拟场景 1：大模型正在调用 [get_reminder_rules]...");
  const res1 = await client.callTool({
    name: "get_reminder_rules",
    arguments: { onlyDigest: true },
  });
  const digest = JSON.parse(res1.content[0].text);
  console.log("🎯 模型拿到的实时提醒：\n" + digest.summaryText);

  // 3. 模拟大模型调用工具 2：用户问“8月份能产出多少钥匙？”
  console.log("\n-------------------------------------------");
  console.log("🤖 模拟场景 2：用户问“8月份能产出多少钥匙？”");
  console.log("大模型正在调用 [get_monthly_yields] (入参: year=2026, month=8, itemName='钥匙')...");
  const res2 = await client.callTool({
    name: "get_monthly_yields",
    arguments: { year: 2026, month: 8, itemName: "钥匙" },
  });
  const yieldResult = JSON.parse(res2.content[0].text);
  console.log(`🎯 统计结果：8月份共有 ${yieldResult.matchCount} 种钥匙，合计产出 ${yieldResult.totalYield} 把！`);
  console.log("明细列表：", yieldResult.items.map((i) => `${i.name}: ${i.monthlyTotal} 把`).join(" | "));

  await client.close();
  console.log("\n🎉 测试顺利通过！");
}

main().catch(console.error);
