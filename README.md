# 《弹壳特攻队》数据中台与自媒体运营 MCP Server

基于 Anthropic MCP (Model Context Protocol) 协议构建的插件服务，面向现代 AI 编程客户端（Claude Desktop, Cursor, Antigravity IDE 等），将 `danke-core` 的游戏规则与资产收益数据无缝暴露给大模型。

## 🛠️ 包含工具 (Tools)

1. **`get_reminder_rules`**
   - 获取当前所有生效的活动周期倒计时、每日打卡提醒（如日常挑战、区域行动、公会探索）。
   - 默认返回格式化简报 (`summaryText`)，专为自媒体攻略生成优化。

2. **`get_monthly_yields`**
   - 查询指定年月的资产产出报表（如钥匙、钻石、核心、S特工碎片）。
   - 支持按道具名称模糊筛选（如 `itemName: "钥匙"`），自动求和统计。

## 🚀 启动与测试

```bash
# 安装依赖
npm install

# 运行自动化集成测试
npm test

# 启动 MCP 服务 (Stdio 模式)
npm start
```

## 本地端口约定

Core 6101，Web 6102，Admin 6103，Rank 6104，Market 开发 6105、独立服务 6106、预览 6112，潮汐开发 6107、API 6108、预览 6113，工具门户 6109，提醒服务 6110，Windows 桥接 6111。显式环境配置优先；线上端口保持部署配置。MCP 使用 stdio，连接 http://localhost:6101。修改 MCP 配置后需重新连接客户端。
