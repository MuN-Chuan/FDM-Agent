# FDM Agent 开源案例库重构设计

## 1. 目标

将当前项目重构为一个单用户、桌面增强型的开源 `FDM Agent`，核心定位为：

- 开源 `FDM` 缺陷案例库
- 基于案例库增强的 `AI` 缺陷诊断与参数优化
- 保留 `3MF` 原生 `CLI` 导出链路
- 保留 `JSON` 预设优化链路
- 保留自定义 `AI` 模型与多提供商配置能力

本轮不实现自动网络采集，仅实现可维护、可扩展的案例库基础版。

## 2. 范围

### 2.1 本轮保留

- `frontend + backend + client-agent` 桌面增强运行模式
- `AI` 功能页与诊断交互主链路
- `3MF` 原生 `CLI` 导出链路
- `JSON` 预设优化链路
- 自定义模型与多 `provider` 配置能力
- 现有 `3MF` 解析、参数补全、override payload、导出回传能力

### 2.2 本轮删除

- 登录、注册、用户权限与认证依赖
- 开发者控制台与开发者专用页面
- 网页生成 / `Stitch` 相关功能
- 与当前开源定位无关的历史入口、运营化能力、多角色准备代码

### 2.3 本轮新增

- `cases/` 开源案例库目录
- `Markdown + frontmatter` 案例维护格式
- 标准化 `JSON` 索引生成器
- 案例库浏览、筛选、详情、检索 `API`
- 前端案例库页面
- 基于案例索引的 `AI` 增强诊断层
- 标准化 `AI` 输出契约
- 开源说明、案例模板、贡献规范

## 3. 总体架构

项目重构后分为两条明确分离的主链路：

1. 案例库链路
2. 参数优化与 `3MF` 执行链路

案例库链路负责案例维护、标准化、筛选与检索。参数优化链路负责参数分析、`JSON` 修改、`3MF CLI` 导出。案例库只为诊断提供上下文增强，不直接参与 `3MF` 文件处理。

## 4. 模块拆分

### 4.1 `frontend/`

保留并收敛为以下用户入口：

- `AI` 诊断 / 对话页
- 案例库浏览页
- 案例详情页
- `3MF / JSON` 优化结果展示
- 模型配置页

删除：

- 登录注册相关界面
- 权限相关界面
- 开发者控制台页面
- 与网页生成相关的页面与导航

### 4.2 `backend/app/services/case_library/`

新增独立案例库服务模块，仅负责：

- 扫描案例 `Markdown`
- 解析 `frontmatter`
- 校验字段与媒体引用
- 生成标准化 `JSON` 索引
- 提供分类、筛选、详情、简单检索能力

禁止承担：

- `AI` 推理
- `3MF` 修改
- `CLI` 导出

### 4.3 `backend/app/services/optimization/`

新增或重组优化服务层，负责：

- 接收图片、缺陷描述、`3MF` 解析结果、预设参数
- 结合案例索引组织 `AI` 上下文
- 输出结构化诊断结果
- 为 `JSON / 3MF` 链路提供结构化修改建议

### 4.4 `backend/app/services/threemf/` 与 `client-agent/`

保留现有主链路，仅承担：

- `3MF` 解析
- override payload 生成
- 本地 `CLI` 调用
- 结果上传与下载

这部分不感知案例原文，只消费结构化参数建议。

## 5. 目录方案

建议新增或调整为如下结构：

```text
cases/
  library/
    <slug>.md
  media/
    <slug>/
      cover.jpg
      step-1.jpg
  schema/
    case.schema.json
  generated/
    case-index.json

backend/app/
  routers/
    case_library.py
  services/
    case_library/
      loader.py
      parser.py
      validator.py
      index_builder.py
      search.py
    optimization/
      prompt_builder.py
      case_matcher.py
      response_parser.py
```

`cases/library` 面向人维护，`cases/generated/case-index.json` 面向程序读取。

## 6. 案例数据模型

### 6.1 仓库维护层

每个案例使用一个 `Markdown` 文件，`frontmatter` 至少包含：

- `case_id`
- `slug`
- `title`
- `defect_category`
- `tags`
- `cover_image`
- `media`
- `printer_model`
- `nozzle_diameter`
- `filament_brand`
- `filament_material`
- `filament_color`
- `slicer_name`
- `slicer_version`
- `profile_source`
- `symptom_parameters`
- `solution_parameters`
- `root_cause_analysis`
- `solution_summary`
- `source_url`
- `source_platform`
- `source_author`
- `source_question`
- `source_answer`
- `license_note`
- `collected_by`
- `review_status`

正文部分用于补充说明、编辑注释、整理摘要与引用上下文。

### 6.2 媒体策略

本轮采用以下媒体策略：

- 仓库内保存缩略图或授权可分发素材
- 保留原文链接与原始平台来源
- 视频优先外链，仓库内保留封面或关键截图

### 6.3 运行索引层

索引生成后输出标准化字段，除原始字段外建议增加：

- `search_text`
- `normalized_defect_category`
- `parameter_delta`
- `materials_normalized`
- `printer_family`

这些派生字段用于提升筛选和 `AI` 命中准确性。

## 7. AI 输出契约

`AI` 输出必须以结构化对象为主，文本说明为辅。建议至少包含：

- `detected_defects[]`
- `evidence[]`
- `matched_cases[]`
- `root_cause_hypotheses[]`
- `parameter_recommendations[]`
- `non_parameter_actions[]`
- `export_payload`
- `explanation_markdown`

其中：

- `matched_cases[]` 必须引用 `case_id`
- `parameter_recommendations[]` 必须包含参数名、当前值、建议值、调整方向、原因
- `export_payload` 必须可被 `JSON / 3MF` 优化链路直接消费

禁止仅返回“调温度、调速度、调流量”这类低颗粒度结论而没有证据和参数上下文。

## 8. 数据流

### 8.1 案例库链路

1. 维护者编辑 `cases/library/*.md`
2. 媒体存放于 `cases/media/<slug>/`
3. 后端启动前或启动时执行索引构建
4. 输出 `cases/generated/case-index.json`
5. 后端只读取标准化索引并暴露筛选、详情与检索能力

### 8.2 优化执行链路

1. 用户上传缺陷图片、`3MF` 或 `JSON` 预设
2. 后端解析参数与打印上下文
3. 优化服务结合案例索引组织 `AI` 提示
4. `AI` 返回结构化建议
5. 前端展示解释、案例引用、参数变更
6. `JSON / 3MF` 模块消费结构化建议
7. `client-agent` 继续执行本地 `CLI` 导出

## 9. 删除 / 保留 / 新增清单

### 9.1 删除

- `auth` 相关路由、服务、模型、前端弹窗与状态
- 开发者控制台页面、路由、面板
- `Stitch` 或网页生成相关代码入口
- 无关历史页面与导航

### 9.2 保留

- `AIChatPage`
- 现有聊天与诊断核心服务
- `3MF` 解析与导出主链路
- `JSON` 预设解析与优化
- 多模型 / 自定义模型配置能力
- `client-agent` 的本地 `CLI` 能力

### 9.3 新增

- 案例库目录与模板
- schema 与索引生成器
- 案例库 `API`
- 前端案例库页面
- 结构化 `AI` 诊断输出
- 开源文档与贡献文档

## 10. 前后端接口原则

后端应将“案例库读取”和“参数优化执行”隔离成独立服务边界：

- 案例库接口只返回案例与筛选结果
- 优化接口只返回诊断与参数建议
- `3MF` 接口只负责文件处理与导出

后续若将 `JSON` 索引替换为 `SQLite`、全文检索或向量检索，不应影响 `3MF / JSON` 执行模块。

## 11. 验证策略

验证分层进行：

- 案例层：字段完整性、媒体路径、来源字段、frontmatter 格式
- 索引层：`case-index.json` 字段规范与分类映射
- `AI` 层：提示上下文、案例命中、结构化输出合法性
- `3MF / JSON` 层：现有参数修改与 `CLI` 导出验证
- 前端层：案例库浏览、筛选、详情、案例引用展示

## 12. 实施顺序

建议按以下顺序执行：

1. 删除无关功能并收敛导航
2. 新增 `cases/`、schema、案例模板、索引生成器
3. 增加案例库后端 `API`
4. 增加前端案例库浏览与筛选
5. 重构 `AI` 诊断为案例增强型结构化输出
6. 让 `JSON / 3MF` 链路消费新的结构化建议
7. 补齐 `README`、贡献文档、示例案例

## 13. 本轮不做

- 自动网页抓取与清洗
- 自动采集调度器
- 向量数据库或复杂检索基础设施
- 多用户、云端协作、权限系统

## 14. 成功标准

重构完成后应满足：

- 仓库定位清晰，开源贡献者能直接理解案例库结构
- 项目仅保留与案例诊断、参数优化、`3MF` 导出相关的核心功能
- `AI` 诊断能引用案例并输出更细颗粒度参数建议
- 案例库与参数执行链路模块化隔离
- 后续扩展数据库或检索方案时无需重做 `3MF / JSON` 主链路
