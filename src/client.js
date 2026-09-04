/**
 * danke-core API 通信客户端
 * 负责与 danke-core 后端进行安全、带超时控制的 HTTP 通信
 * 预留了 BaseURL 动态注入与线上 Token 口子
 */

export class DankeApiClient {
  constructor(options = {}) {
    // 优先读取环境变量，没有则默认走本地开发端口 3000
    this.baseUrl = (options.baseUrl || process.env.DANKE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    this.apiToken = options.apiToken || process.env.DANKE_AUTH_TOKEN || '';
    this.timeout = options.timeout || 10000; // 默认 10 秒超时
  }

  /**
   * 通用底层请求方法
   */
  async request(path, options = {}) {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    
    // 超时控制 (AbortController)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // 如果未来线上接口需要鉴权，自动带上 Authorization 头
    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`[danke-core HTTP ${response.status}] ${response.statusText} - ${errorBody}`);
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`[danke-core] 请求超时 (${this.timeout}ms): ${url}`);
      }
      throw err;
    }
  }

  /**
   * 1. 获取今日活动倒计时与提醒简报 (最适合文案生成的精华摘要)
   * 对应接口: GET /reminders/daily-digest
   */
  async getReminderDailyDigest(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request(`/reminders/daily-digest${query}`);
  }

  /**
   * 2. 获取原始提醒规则列表
   * 对应接口: GET /reminders
   */
  async getReminders(category) {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return this.request(`/reminders${query}`);
  }

  /**
   * 3. 获取月度资产产出报表 (为后续钥匙产出查询做准备)
   * 对应接口: GET /yields/monthly-report?year=2026&month=8
   */
  async getMonthlyReport(year, month) {
    return this.request(`/yields/monthly-report?year=${year}&month=${month}`);
  }
}
