# 截图控制子系统架构设计

**日期**: 2026-04-04
**功能**: 使用 OpenRouter bytedance/ui-tars-1.5-7b 模型实现截图控制 Bambu Studio

## 1. 背景与目标

### 1.1 问题场景

拓竹打印机新版固件 (V01.08.03+) 的 HMS_0500 安全策略拦截了云端回中 (home) 和轴移动 (move_axis) 请求。现有 `bambu-cli` 无法绕过此限制。

### 1.2 解决方案

通过截图视觉 AI 控制 (Vision-based GUI Automation)：捕获 Bambu Studio 界面截图 → AI 模型识别目标元素位置 → Agent 模拟鼠标点击/输入操作。

### 1.3 设计目标

1. **核心用途**: 官方控制方式不支持的功能（如 HMS_0500 绕过）
2. **扩展性**: 支持多种切片软件（Bambu Studio、OrcaSlicer 等）
3. **灵活性**: 优先云端推理，提供本地推理接口

## 2. 整体架构

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│  Bambu Studio   │      │ Client-Agent │      │     Backend     │
│  (截图目标)      │──────▶│  截图捕获    │      │                 │
└─────────────────┘      └──────┬───────┘      └────────┬────────┘
                                │                       │
                                │ 截图 base64           │ API 调用
                                ▼                       ▼
                         ┌──────────────┐      ┌─────────────────┐
                         │  pyautogui   │◀─────│  OpenRouter     │
                         │  指令执行    │      │  bytedance/     │
                         └──────────────┘      │  ui-tars-1.5-7b │
                                                └─────────────────┘
```

## 3. 组件职责

### 3.1 Client-Agent 侧

| 组件 | 路径 | 职责 |
|------|------|------|
| `vision_controller.py` | `client-agent/scripts/` | 截图捕获、AI 推理请求、指令解析、pyautogui 执行 |
| `printer.js` | `client-agent/src/handlers/` | 复用现有 `executeViaFara7B`，改由 `vision_controller.py` 实现 |
| `commands.js` | `client-agent/src/` | 路由 `vision_control` 命令到 handler |

**新增命令：**
```javascript
{
  "cmd": "vision_control",
  "task": "home_printer",
  "params": {
    "target_app": "Bambu Studio",
    "window_title": "Bambu Studio"
  }
}
```

### 3.2 Backend 侧

| 组件 | 路径 | 职责 |
|------|------|------|
| `vision_router.py` | `backend/app/routers/` | 新增 `/api/agent/vision/analyze` 端点 |
| `vision_service.py` | `backend/app/services/` | 调用 OpenRouter API 发送截图并解析响应 |
| `openrouter_provider.py` | `backend/app/services/providers/` | 已在 `models` 列表中添加 `bytedance/ui-tars-1.5-7b` |

**新增 API：**

| 方法 | 端点 | 说明 |
|------|------|------|
| `POST` | `/api/agent/vision/analyze` | 发送截图给 AI 模型分析 |

**请求体：**
```json
{
  "screenshot_base64": "<base64 编码的截图>",
  "task": "home_printer",
  "context": {
    "target_app": "Bambu Studio",
    "available_actions": ["click", "type", "move_mouse"]
  }
}
```

**响应（流式 SSE）：**
```json
{"type": "progress", "content": "分析中..."}
{"type": "progress", "content": "正在定位 Home 按钮..."}
{"type": "done", "action": {"type": "click", "x": 150, "y": 320}, "description": "点击 Home 按钮"}
```

### 3.3 前端侧

| 组件 | 路径 | 职责 |
|------|------|------|
| `useVisionControl.ts` | `frontend/src/features/slicer/` | 新 Hook，封装 vision_control 命令发送 |
| `VisionControlPanel.tsx` | `frontend/src/features/slicer/` | 新组件，显示控制状态和手动触发按钮 |

## 4. 指令格式

### 4.1 AI 模型返回格式

模型应返回结构化 JSON：

```json
{
  "type": "action",
  "action": "click",
  "x": 150,
  "y": 320,
  "description": "点击 Home 按钮"
}
```

支持的动作类型：

| action | 参数 | 说明 |
|--------|------|------|
| `click` | x, y | 在坐标 (x, y) 处单击 |
| `double_click` | x, y | 双击 |
| `right_click` | x, y | 右键点击 |
| `type` | text | 输入文本 |
| `move_mouse` | x, y | 移动鼠标 |
| `scroll` | x, y, delta | 滚动 |

### 4.2 prompt 模板

```
分析此截图。用户目标: {task}

可用动作: click, double_click, right_click, type, move_mouse, scroll

返回 JSON:
{"type": "action", "action": "<动作>", "x": <x>, "y": <y>, "description": "<描述>"}
```

## 5. 错误处理

| 错误类型 | 处理方式 | 前端提示 |
|----------|----------|----------|
| AI 模型超时 | Agent 返回 `{error: "vision_timeout"}` | "AI 分析超时，请重试" |
| 截图捕获失败 | Agent 返回 `{error: "screenshot_failed"}` | "无法捕获截图，请检查窗口是否打开" |
| 非结构化 AI 响应 | Agent 尝试解析，失败返回原始文本 | "AI 响应格式异常" |
| pyautogui 执行失败 | 返回 `{error: "action_failed", message: "..."}` | "执行动作失败: {message}" |
| 目标窗口未找到 | 返回 `{error: "window_not_found"}` | "找不到目标窗口，请确保应用已打开" |

## 6. 切片软件扩展性

### 6.1 配置结构

```json
// config.example.json
{
  "vision_providers": {
    "bambu_studio": {
      "window_title": "Bambu Studio",
      "capture_mode": "full",
      "model": "bytedance/ui-tars-1.5-7b",
      "prompt_template": "..."
    },
    "orca_slicer": {
      "window_title": "OrcaSlicer",
      "capture_mode": "full",
      "model": "bytedance/ui-tars-1.5-7b"
    }
  }
}
```

### 6.2 扩展流程

1. 在 `config.json` 中添加新的切片软件配置
2. 提供对应的窗口标题和 capture_mode
3. AI prompt 可使用自定义模板
4. 无需修改核心代码

## 7. 文件修改清单

### 7.1 新增文件

| 文件 | 说明 |
|------|------|
| `backend/app/routers/vision_router.py` | Vision API 路由 |
| `backend/app/services/vision_service.py` | Vision 服务 |
| `client-agent/scripts/vision_controller.py` | 核心视觉控制器 |
| `frontend/src/features/slicer/useVisionControl.ts` | Vision Control Hook |
| `frontend/src/features/slicer/VisionControlPanel.tsx` | Vision 控制面板组件 |

### 7.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `backend/app/routers/agent.py` | 添加 `/api/agent/vision/analyze` 路由 |
| `backend/app/services/providers/openrouter_provider.py` | 添加 `bytedance/ui-tars-1.5-7b` 模型 |
| `client-agent/src/handlers/printer.js` | 改进 `executeViaFara7B`，支持视觉控制 |
| `client-agent/src/commands.js` | 添加 `vision_control` 命令路由 |
| `client-agent/config.example.json` | 添加 `vision_providers` 配置 |

## 8. 实现优先级

1. **Phase 1**: Client-Agent 截图 + 后端 OpenRouter 调用
2. **Phase 2**: 指令解析 + pyautogui 执行
3. **Phase 3**: 前端 UI 集成
4. **Phase 4**: 错误处理增强 + 多切片软件支持

## 9. 验证清单

- [ ] 截图能成功捕获 Bambu Studio 窗口
- [ ] 后端能调用 OpenRouter bytedance/ui-tars-1.5-7b
- [ ] AI 返回的结构化指令能被正确解析
- [ ] pyautogui 能模拟点击到正确位置
- [ ] 前端能接收 Agent 的进度反馈
- [ ] 错误场景有合理提示
