# FDM-AI Client Agent

本地 Agent 运行在你的电脑上，通过 **WebSocket** 接收前端网页的指令，执行本机操作：

| 功能 | 工具 |
|------|------|
| 3MF 切片级重打包 | BambuStudio CLI |
| 打印机控制（开始/暂停/停止/状态）| bambu-cli |
| 推送状态通知到前端 | WebSocket |

## 快速启动

```bash
# 1. 安装依赖
cd client-agent
npm install

# 2. 配置（复制并编辑）
cp config.example.json config.json

# 3. 启动
npm start
```

默认监听端口：`ws://localhost:7890`

## 配置文件 (config.json)

```json
{
  "port": 7890,
  "backend_url": "http://localhost:8000",
  "bambu_studio_path": "C:/Program Files/Bambu Studio/bambu-studio.exe",
  "bambu_cli_path": "bambu-cli",
  "printer": {
    "host": "192.168.1.xxx",
    "serial": "YOUR_PRINTER_SERIAL",
    "access_code": "YOUR_ACCESS_CODE"
  }
}
```

## 支持的命令

前端通过 WebSocket 发送 JSON 消息：

### 3MF 重打包
```json
{
  "cmd": "repack_3mf",
  "job_id": "<server-job-id>",
  "output_name": "optimized.3mf"
}
```

### 打印控制
```json
{ "cmd": "print_start", "job_id": "<server-job-id>", "file_name": "optimized.3mf" }
{ "cmd": "print_pause" }
{ "cmd": "print_resume" }
{ "cmd": "print_stop" }
{ "cmd": "printer_status" }
```

## Agent → 前端推送格式
```json
{
  "type": "status" | "progress" | "done" | "error",
  "cmd": "repack_3mf",
  "job_id": "...",
  "message": "...",
  "data": { ... }
}
```
