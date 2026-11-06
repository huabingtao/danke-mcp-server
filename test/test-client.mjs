import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverScript = path.resolve(__dirname, "../src/index.js");

const transport = new StdioClientTransport({
  command: "node",
  args: [serverScript],
});

const client = new Client(
  { name: "danke-test-client", version: "1.1.0" },
  { capabilities: {} }
);

async function main() {
  console.log("正在连接 danke-mcp-server...");
  await client.connect(transport);
  console.log("✅ 成功连接！");

  // 1. 列出支持的所有工具
  const { tools } = await client.listTools();
  console.log("\n📦 当前可用工具列表：");
  tools.forEach((t) => console.log(` - 🛠️ ${t.name}: ${t.description}`));
  const toolNames = tools.map((t) => t.name);
  assert.ok(toolNames.includes("get_wiki_index"), "应包含 get_wiki_index 工具");
  assert.ok(toolNames.includes("get_wiki_domain"), "应包含 get_wiki_domain 工具");
  assert.ok(toolNames.includes("search_danke_wiki"), "应包含 search_danke_wiki 工具");

  // 2. 测试 LLM Wiki 工具 1：get_wiki_index
  console.log("\n-------------------------------------------");
  console.log("🤖 测试 [get_wiki_index]...");
  const wikiIdxRes = await client.callTool({
    name: "get_wiki_index",
    arguments: { includeLog: true },
  });
  const wikiIdxText = wikiIdxRes.content[0].text;
  assert.ok(wikiIdxText.includes("[[agents]]"), "index.md 应包含 [[agents]] 领域入口");
  assert.ok(wikiIdxText.includes("[[equipment-and-forge]]"), "index.md 应包含 [[equipment-and-forge]] 领域入口");
  console.log(`🎯 成功读取 Wiki 总索引（长度: ${wikiIdxText.length} 字符）`);

  // 3. 测试 LLM Wiki 工具 2：get_wiki_domain
  console.log("\n-------------------------------------------");
  console.log("🤖 测试 [get_wiki_domain] (domain='agents', sectionKeyword='伊狑844')...");
  const domainRes = await client.callTool({
    name: "get_wiki_domain",
    arguments: { domain: "agents", sectionKeyword: "伊狑844" },
  });
  const domainText = domainRes.content[0].text;
  assert.ok(domainText.includes("156 核"), "agents 领域应包含伊狑844的156核节点数据");
  console.log("🎯 成功读取 agents 领域章节！");

  // 4. 测试 LLM Wiki 工具 3：search_danke_wiki
  console.log("\n-------------------------------------------");
  console.log("🤖 测试 [search_danke_wiki] (query='月殇护手 神炼 2')...");
  const searchRes = await client.callTool({
    name: "search_danke_wiki",
    arguments: { query: "月殇护手 神炼 2", maxResults: 3 },
  });
  const searchPayload = JSON.parse(searchRes.content[0].text);
  assert.ok(searchPayload.hitCount > 0, "搜索应返回至少 1 条命中记录");
  console.log(
    `🎯 搜索命中 ${searchPayload.hitCount} 条段落，首条来自: ${searchPayload.results[0].sourceFile} -> ${searchPayload.results[0].heading}`
  );

  await client.close();
  console.log("\n🎉 LLM Wiki & MCP Server 集成测试全部通过！");
}

main().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
