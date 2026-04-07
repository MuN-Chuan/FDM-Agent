# Desktop Vision `home_printer` 联调说明

**日期**: 2026-04-07
**目标**: 在本机完成 `Desktop Vision -> home_printer` 的最小联调闭环

## 1. 前提

当前代码状态：

- `Desktop Vision` 已完成 backend 协议层
- `client-agent` 已完成 session 化运行时骨架
- 前端已接入 `Desktop Vision` 模式
- 第一阶段只支持 `home_printer`

不在本次联调范围：

- `move_axis`
- 任意桌面文本输入
- 通用 UI 自动化

## 2. 需要配置的文件

## 2.1 Backend

文件：

- `.env`

至少补这两个字段：

```env
DESKTOP_VISION_AGENT_TOKEN=fdm-desktop-vision-dev-token
```

说明：

- `OpenRouter` 的 API Key 统一从项目根目录的 `providers.json` 读取
- `DESKTOP_VISION_AGENT_TOKEN` 用于允许本机 agent 调用 `/api/agent/desktop-vision/plan`

建议：

- 测试阶段先固定为 `fdm-desktop-vision-dev-token`
- 后续再改成自动生成并与账号系统绑定

## 2.2 Client-Agent

文件：

- `client-agent/config.json`

至少确保这些字段存在：

```json
{
  "port": 7890,
  "backend_url": "http://localhost:8000",
  "desktop_vision_auth_token": "fdm-desktop-vision-dev-token",
  "bambu_studio_path": "C:/Program Files/Bambu Studio/bambu-studio.exe",
  "vision_providers": {
    "bambu_studio": {
      "window_title": "Bambu Studio",
      "capture_mode": "full",
      "model": "bytedance/ui-tars-1.5-7b"
    }
  }
}
```

注意：

- `desktop_vision_auth_token` 必须和 backend 的 `DESKTOP_VISION_AGENT_TOKEN` 一致
- 当前默认路径会回退到 `C:/Program Files/Bambu Studio/bambu-studio.exe`
- 后续再补自动探测和手动编辑能力

## 3. 启动顺序

推荐顺序：

1. 启动 backend
2. 启动 frontend
3. 启动 client-agent
4. 打开 `Bambu Studio`
5. 打开前端打印机控制页

## 3.1 启动 backend

在项目根目录或 `backend` 目录运行你的现有启动方式。

如果你当前本地是直接跑 FastAPI，可确认：

```bash
curl http://localhost:8000/health
```

应返回健康检查结果。

## 3.2 启动 frontend

开发模式：

```bash
cd frontend
npm run dev
```

或使用已构建产物。

## 3.3 启动 client-agent

```bash
cd client-agent
npm start
```

预期日志中至少应出现：

- `FDM-AI Client Agent listening on ws://localhost:7890`
- `Backend API: http://localhost:8000`
- `BambuStudio: ...`

## 4. 联调前检查

在真正点“回中”前，先检查：

1. `Bambu Studio` 已打开，且窗口标题包含 `Bambu Studio`
2. 前端顶部或打印机页能连接本地 agent
3. 目标打印机已出现在页面中
4. 前端切换到 `Desktop Vision (Home Only)` 模式

## 5. 触发方式

## 5.1 从前端触发

路径：

- 打印机详情页
- `Control Mode` 切到 `Desktop Vision (Home Only)`
- 点击 `Home`
- 在确认弹窗中确认

预期前端表现：

- `Desktop Vision` 面板开始刷新状态
- 出现 step、state、session id
- 日志区出现 progress / done / error

## 5.2 从 WebSocket 手工触发

如果要绕过 UI，可直接给 agent 发：

```json
{
  "cmd": "desktop_vision_run",
  "task": "home_printer",
  "printer_id": "你的打印机ID",
  "target_app": "bambu_studio",
  "options": {
    "max_steps": 5
  }
}
```

## 6. 成功判定

满足以下任一组即可认为首轮联调成功：

### A. 最小成功

- 前端能显示 `Desktop Vision` session
- agent 能成功调用 backend planner
- 本地能生成 before/after 截图
- 能走完整个任务流程并返回 `done` 或明确失败阶段

### B. 完整成功

- Bambu Studio 被自动聚焦
- 模型成功输出点击动作
- agent 成功点击目标位置
- 执行后截图出现状态变化
- 前端收到 `done`
- 打印机开始回中或界面进入回中相关状态

## 7. 常见失败点

## 7.1 401 Unauthorized

表现：

- agent 报错：`Desktop vision planner rejected the request with 401`

排查：

- backend `.env` 的 `DESKTOP_VISION_AGENT_TOKEN` 是否已生效
- `client-agent/config.json` 的 `desktop_vision_auth_token` 是否一致
- backend 是否重启过

## 7.2 Window not found

表现：

- agent 报错找不到 `Bambu Studio`

排查：

- `Bambu Studio` 是否真的在前台或已启动
- 窗口标题是否包含 `Bambu Studio`
- `client-agent/config.json` 中 `vision_providers.bambu_studio.window_title` 是否正确

## 7.3 Planner failed

表现：

- backend 返回 `failed`
- 或 agent 报 `planner failed`

排查：

- `providers.json` 中 `openrouter.api_key` 是否有效
- OpenRouter 账户是否有额度
- `bytedance/ui-tars-1.5-7b` 是否可用

## 7.4 Verification failed

表现：

- 点击已执行，但 after screenshot 和 before screenshot 没有显著差异

排查：

- 目标按钮是否确实触发了界面变化
- 点击位置是否偏移
- 验证模式是否过严

## 8. 联调后建议记录

每次联调建议记录：

1. 使用的打印机型号
2. Bambu Studio 版本
3. 屏幕分辨率和缩放比例
4. 任务是否成功
5. 失败阶段：
   - preparing
   - capturing
   - planning
   - validating_action
   - executing
   - verifying
6. 对应 before/after 截图路径

## 9. 当前结论

当前代码已经适合进入 `home_printer` 的首轮实机联调。

联调目标不是一次性做到百分百稳定，而是先确认三件事：

1. backend planner 能被 agent 成功调用
2. 本地截图与点击链路真实可执行
3. `home_printer` 能跑通至少一条有效路径

只要这三件事成立，后续再继续打磨 prompt、验证策略和 UI 细节即可。
