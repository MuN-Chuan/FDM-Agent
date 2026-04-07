# 截图控制子系统实施计划

**日期**: 2026-04-07
**目标**: 将现有截图控制 PoC 重构为正式的桌面视觉控制子系统，用于通过 `OpenRouter / bytedance/ui-tars-1.5-7b` 控制本地 `Bambu Studio`

## 1. 实施范围

本计划只覆盖以下目录：

- `backend/app/models/`
- `backend/app/routers/`
- `backend/app/services/`
- `client-agent/src/handlers/`
- `client-agent/src/runtime/`
- `frontend/src/features/printer/`
- `frontend/src/features/slicer/`
- `client-agent/config.example.json`

明确不改：

- 3MF 主链路
- `plugins/slicer_engines/`
- 现有 `LAN / MQTT / Studio DLL` 主控制逻辑

## 2. 当前代码基线

现有已存在能力：

- `OpenRouter` provider 已可用
- `bytedance/ui-tars-1.5-7b` 已在模型列表中
- `client-agent` 与前端 WebSocket 已打通
- 已有截图 + 视觉分析 + 点击执行 PoC

现有待重构点：

- `backend/app/services/vision_service.py`
- `backend/app/routers/vision_router.py`
- `client-agent/scripts/vision_controller.py`
- `client-agent/src/handlers/printer.js`
- `frontend/src/features/printer/PrinterDetailView.tsx`

## 3. 实施阶段

### Phase 1: 建立正式 Backend 协议层

目标：

- 正式定义桌面视觉规划模型
- 不再依赖实验版 `vision_service.py` 作为主链路

新增文件：

- `backend/app/models/desktop_vision.py`
- `backend/app/services/desktop_vision_prompt_builder.py`
- `backend/app/services/desktop_vision_service.py`
- `backend/app/routers/desktop_vision_router.py`
- `backend/tests/test_desktop_vision_service.py`
- `backend/tests/test_desktop_vision_router.py`

修改文件：

- `backend/app/main.py`

任务拆解：

1. 在 `backend/app/models/desktop_vision.py` 中定义 Pydantic 模型：
   - `DesktopVisionScreen`
   - `DesktopVisionHistoryStep`
   - `DesktopVisionPlanRequest`
   - `DesktopVisionAction`
   - `DesktopVisionVerification`
   - `DesktopVisionPlanResponse`

2. 在 `desktop_vision_prompt_builder.py` 中实现：
   - 任务白名单校验
   - Prompt 组装
   - 历史步骤压缩
   - 动作 schema 描述

3. 在 `desktop_vision_service.py` 中实现：
   - 固定通过 `provider_registry.get_provider("openrouter")`
   - 模型使用 `bytedance/ui-tars-1.5-7b`
   - 解析结构化 JSON
   - 对返回动作做服务端校验：
     - action type 必须在白名单
     - 坐标必须为整数
     - confidence 必须在 `0~1`
     - status 只能是 `continue / done / failed`

4. 在 `desktop_vision_router.py` 中提供：
   - `POST /api/agent/desktop-vision/plan`

5. 在 `main.py` 中注册新 router

交付标准：

- 新接口能返回结构化规划结果
- 不依赖旧 `vision_router.py`
- 有独立测试覆盖 prompt 和 schema 校验

### Phase 2: 重构 Client-Agent 运行时

目标：

- 从“调用 Python 脚本一次性执行”升级为“任务会话式运行时”

新增文件：

- `client-agent/src/handlers/desktopVision.js`
- `client-agent/src/runtime/windowCapture.js`
- `client-agent/src/runtime/inputExecutor.js`
- `client-agent/src/runtime/taskSession.js`
- `client-agent/src/runtime/actionValidator.js`
- `client-agent/src/runtime/resultVerifier.js`
- `client-agent/test/desktopVision.test.js`

修改文件：

- `client-agent/src/commands.js`
- `client-agent/src/index.js`
- `client-agent/src/handlers/printer.js`

建议的模块职责：

- `desktopVision.js`
  - 视觉任务入口
  - 调后端 planner
  - 驱动循环执行
- `windowCapture.js`
  - 查找窗口
  - 恢复/激活窗口
  - 截图
  - 窗口内坐标转屏幕坐标
- `inputExecutor.js`
  - click / double_click / type / hotkey / scroll / wait
- `taskSession.js`
  - session_id
  - step 计数
  - 历史记录
  - 超时和取消
- `actionValidator.js`
  - 执行动作前校验
- `resultVerifier.js`
  - 执行后截图验证

任务拆解：

1. 新增 `desktop_vision_run` 命令
2. 新增 `desktop_vision_cancel` 命令
3. 在 `index.js` 的 hello capability 中加入：
   - `desktop_vision_run`
   - `desktop_vision_cancel`
4. 将 `executeViaFara7B` 的主逻辑迁出 `printer.js`
5. `printer.js` 中与视觉相关的旧入口保留兼容层，但内部转发到 `desktopVision.js`

交付标准：

- Agent 能维持一个多步视觉任务 session
- 前端能收到逐步事件
- 用户可中途取消

### Phase 3: 落首个正式任务 `home_printer`

目标：

- 实现一个受控、可验证、可复现的生产级任务

支持任务：

- `home_printer`

任务流程：

1. 聚焦 `Bambu Studio`
2. 截图
3. 请求 planning
4. 执行动作
5. 再截图
6. 验证界面状态变化
7. 未完成则进入下一步

约束：

- 最大步数：5
- 动作白名单：
  - `click`
  - `double_click`
  - `wait`
- 必须经过前端确认

验收标准：

- 能稳定触发一次回中操作
- 失败时给出具体阶段：
  - planning_failed
  - action_invalid
  - execution_failed
  - verification_failed
  - max_steps_exceeded

### Phase 4: 落第二个任务 `move_axis`

目标：

- 在 `home_printer` 基础上支持轴移动

支持任务：

- `move_axis`

额外约束：

- 仅允许有限位移：
  - `X/Y`: `±1/±10`
  - `Z`: `±0.1/±1`
- 每次任务只允许一个轴向动作
- 必须前端确认

验收标准：

- 移轴动作只在允许范围内执行
- 不允许模型构造任意输入动作

### Phase 5: 前端产品化

目标：

- 把当前 `fara_7b` 暂时模式改造成正式产品入口

新增文件：

- `frontend/src/features/printer/DesktopVisionTaskPanel.tsx`

修改文件：

- `frontend/src/features/slicer/ClientAgentBridge.ts`
- `frontend/src/features/printer/PrinterDetailView.tsx`
- `frontend/src/features/slicer/useVisionControl.ts`

任务拆解：

1. `ClientAgentBridge.ts`
   - 增加 `desktopVisionRun(task, payload)`
   - 增加 `desktopVisionCancel(sessionId)`

2. `PrinterDetailView.tsx`
   - 用户可见文案从 `Fara-7B Vision` 改为 `Desktop Vision`
   - 增加风险提示
   - 增加 session 进度展示

3. `DesktopVisionTaskPanel.tsx`
   - 展示：
     - 当前步骤
     - 当前状态
     - 最近动作
     - 错误信息
     - 取消按钮

验收标准：

- 用户不直接感知模型名
- 视觉任务有独立面板和独立状态

### Phase 6: 清理旧 PoC 入口

目标：

- 保留兼容但降低旧接口优先级

处理建议：

- `backend/app/routers/vision_router.py`
  - 标记为 legacy
- `backend/app/services/vision_service.py`
  - 标记为 legacy
- `client-agent/scripts/vision_controller.py`
  - 标记为 debug-only
- `frontend/src/features/slicer/useVisionControl.ts`
  - 仅保留兼容层或转发层

验收标准：

- 正式链路不再依赖旧 PoC 文件
- 兼容层可逐步下线

## 4. 文件级实施清单

### Backend 新增

- `backend/app/models/desktop_vision.py`
- `backend/app/services/desktop_vision_prompt_builder.py`
- `backend/app/services/desktop_vision_service.py`
- `backend/app/routers/desktop_vision_router.py`
- `backend/tests/test_desktop_vision_service.py`
- `backend/tests/test_desktop_vision_router.py`

### Backend 修改

- `backend/app/main.py`

### Client-Agent 新增

- `client-agent/src/handlers/desktopVision.js`
- `client-agent/src/runtime/windowCapture.js`
- `client-agent/src/runtime/inputExecutor.js`
- `client-agent/src/runtime/taskSession.js`
- `client-agent/src/runtime/actionValidator.js`
- `client-agent/src/runtime/resultVerifier.js`
- `client-agent/test/desktopVision.test.js`

### Client-Agent 修改

- `client-agent/src/commands.js`
- `client-agent/src/index.js`
- `client-agent/src/handlers/printer.js`
- `client-agent/config.example.json`

### Frontend 新增

- `frontend/src/features/printer/DesktopVisionTaskPanel.tsx`

### Frontend 修改

- `frontend/src/features/slicer/ClientAgentBridge.ts`
- `frontend/src/features/printer/PrinterDetailView.tsx`
- `frontend/src/features/slicer/useVisionControl.ts`

## 5. 数据结构建议

### 5.1 Backend Request

```json
{
  "session_id": "dv_20260407_xxx",
  "task": "home_printer",
  "step": 1,
  "screen": {
    "image_base64": "<base64>",
    "width": 1440,
    "height": 900,
    "window_title": "Bambu Studio"
  },
  "history": [],
  "allowed_actions": ["click", "double_click", "wait"]
}
```

### 5.2 Backend Response

```json
{
  "status": "continue",
  "action": {
    "type": "click",
    "x": 1200,
    "y": 640,
    "reason": "点击回中按钮",
    "confidence": 0.91
  },
  "verification": {
    "mode": "screen_change",
    "expectation": "界面出现回中执行中的状态提示"
  }
}
```

### 5.3 Agent Event

```json
{
  "type": "progress",
  "cmd": "desktop_vision_run",
  "data": {
    "session_id": "dv_20260407_xxx",
    "task": "home_printer",
    "state": "executing",
    "step": 2,
    "action": "click"
  }
}
```

## 6. 安全和风控要求

必须落地的约束：

- 任务白名单
- 动作白名单
- 最大步数
- 坐标必须为窗口内相对坐标
- 高风险任务前端二次确认
- 每步执行后验证
- 支持用户取消

第一阶段禁止：

- 任意文本输入
- drag
- 右键菜单链式操作
- 多任务并行执行

## 7. 测试计划

### 单元测试

- prompt builder
- 模型响应解析
- action validator
- result verifier
- command routing

### 集成测试

- Backend 新路由可调用
- Agent 能建立 session
- 前端能接收 progress/done/error

### 手工验证

1. 打开本地 `Bambu Studio`
2. 在前端进入打印机详情页
3. 选择 `Desktop Vision`
4. 发起 `home_printer`
5. 观察：
   - 前端步骤更新
   - Agent 本地截图生成
   - 操作成功或给出明确失败原因

## 8. 建议的开发顺序

推荐实际编码顺序：

1. Backend schema + router
2. Backend service + parser
3. Agent runtime skeleton
4. Agent `desktop_vision_run`
5. `home_printer` 首任务
6. Frontend 状态展示
7. `move_axis`
8. 兼容层清理

## 9. 里程碑定义

### Milestone A

新 backend 协议完成，旧 PoC 不再扩展

### Milestone B

Agent 运行时完成，可执行 session 化视觉任务

### Milestone C

`home_printer` 正式可用

### Milestone D

`move_axis` 正式可用

### Milestone E

前端产品化完成，`fara_7b` 用户可见命名下线

## 10. 结论

下一步不应继续围绕旧 PoC 局部打补丁，而应按本计划先做“协议层 + 运行时”重构。

如果进入代码实现，建议先交付 `Phase 1 + Phase 2 + Phase 3`，即：

- 新 backend 规划接口
- 新 agent 会话运行时
- 首个正式任务 `home_printer`

这三项完成后，系统才具备继续扩展 `move_axis` 和其他桌面视觉任务的基础。
