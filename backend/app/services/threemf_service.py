"""
threemf_service.py — 3MF 文件解析、修改、重打包服务

3MF 格式说明：
  - 3MF 是标准 ZIP 压缩包
  - Metadata/project_settings.config — 扁平 JSON，包含所有预设参数
    (printer + process + filament 全部合并在一个对象中)
  - 3D/3dmodel.model — 3D 几何数据 (XML)
  - Metadata/model_settings.config — 对象摆放、盘面配置 (XML)
  - Metadata/plate_*.png — 预览图
"""

import json
import zipfile
import io
import copy
from pathlib import Path
from typing import Any

# ─── 关键预设摘要字段 ─────────────────────────────────────────────
# 从 project_settings.config 中提取给 AI 上下文的字段
# (完整 JSON 约有 1076 行，只取关键字段)
_SUMMARY_FIELDS: list[str] = [
    # 标识
    "printer_settings_id",
    "print_settings_id",
    "filament_settings_id",
    "printer_model",
    "printer_variant",
    # 工艺核心参数
    "layer_height",
    "initial_layer_print_height",
    "line_width",
    "outer_wall_line_width",
    "inner_wall_line_width",
    # 速度
    "outer_wall_speed",
    "inner_wall_speed",
    "initial_layer_speed",
    "infill_speed",
    # 温度
    "nozzle_temperature",
    "nozzle_temperature_initial_layer",
    "hot_plate_temp",
    "hot_plate_temp_initial_layer",
    "cool_plate_temp",
    # 强度
    "wall_loops",
    "top_shell_layers",
    "bottom_shell_layers",
    "sparse_infill_density",
    "sparse_infill_pattern",
    # 支撑
    "enable_support",
    "support_type",
    # 耗材
    "filament_type",
    "filament_colour",
    "filament_settings_id",
    "filament_flow_ratio",
    # 平台
    "curr_bed_type",
    # 其他常用
    "default_acceleration",
    "outer_wall_acceleration",
    "brim_type",
    "brim_width",
    "seam_position",
    "print_sequence",
]


# ─── 主服务函数 ───────────────────────────────────────────────────

def parse_3mf(file_bytes: bytes) -> dict[str, Any]:
    """
    从 3MF 文件字节中解析完整预设 JSON。
    返回包含所有参数的扁平字典 (project_settings.config 的内容)。
    抛出 ValueError 如果文件不是有效的 3MF 或缺少预设配置。
    """
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            namelist = zf.namelist()
            preset_file = "Metadata/project_settings.config"
            if preset_file not in namelist:
                raise ValueError(
                    f"Not a Bambu/Orca 3MF: missing '{preset_file}'. "
                    f"Available files: {', '.join(namelist[:10])}"
                )
            raw = zf.read(preset_file)
            settings = json.loads(raw.decode("utf-8"))
    except zipfile.BadZipFile:
        raise ValueError("File is not a valid ZIP/3MF archive")

    if not isinstance(settings, dict):
        raise ValueError("project_settings.config is not a JSON object")

    return settings


def extract_summary(settings: dict[str, Any]) -> dict[str, Any]:
    """
    从完整预设 dict 中提取关键字段摘要，供 AI 上下文使用。
    返回 { field: value } 的精简字典。
    数组类型取第一个元素（filament 参数）以便 AI 易读。
    """
    summary: dict[str, Any] = {}
    for key in _SUMMARY_FIELDS:
        if key not in settings:
            continue
        val = settings[key]
        # 数组参数（如 filament_type: ["PLA"]）取首元素
        if isinstance(val, list) and len(val) == 1:
            val = val[0]
        elif isinstance(val, list) and len(val) > 1:
            # 多耗材保留数组
            pass
        summary[key] = val
    return summary


def filter_gcode(settings: dict[str, Any]) -> dict[str, Any]:
    """
    Filter out long G-code strings and metadata (like thumbnails) to save tokens for the AI.
    Returns a copy of the dict without these fields.
    """
    ignored_suffixes = ("_gcode", "gcode", "thumbnails")
    return {
        k: v for k, v in settings.items()
        if not any(k.endswith(s) for s in ignored_suffixes)
    }


def apply_modifications(
    settings: dict[str, Any],
    modifications: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    将 AI 的 json_modifications 应用到完整预设 dict 中。

    modifications 格式（复用已有 chat_service 输出格式）：
    [
      { "name": "layer_height", "old": "0.2", "new": "0.16", "category": "process" },
      ...
    ]

    3MF 的 project_settings.config 是扁平结构，不区分 category，
    直接按 name 键匹配并覆盖即可。

    对于数组类型的参数（如 nozzle_temperature: ["220"]），
    新值如果是标量则替换第一个元素；如果是数组则整体替换。
    """
    result = copy.deepcopy(settings)
    applied: list[str] = []
    skipped: list[str] = []

    for mod in modifications:
        name = mod.get("name", "")
        new_val = mod.get("new")
        if not name or new_val is None:
            continue

        if name not in result:
            skipped.append(name)
            continue

        original = result[name]

        # 数组参数：用新值替换第一个元素（保持结构）
        if isinstance(original, list):
            if isinstance(new_val, list):
                result[name] = new_val
            else:
                updated = list(original)
                if updated:
                    # 尝试类型转换保持一致
                    try:
                        first = updated[0]
                        if isinstance(first, (int, float)) and isinstance(new_val, str):
                            new_val = type(first)(new_val)
                    except (ValueError, TypeError):
                        pass
                    updated[0] = new_val
                else:
                    updated = [new_val]
                result[name] = updated
        else:
            # 标量参数：直接覆盖
            result[name] = new_val

        applied.append(name)

    result["_ai_modifications_applied"] = applied
    result["_ai_modifications_skipped"] = skipped
    return result


def repack_3mf(
    original_bytes: bytes,
    modified_settings: dict[str, Any],
) -> bytes:
    """
    将修改后的预设重新打包回 3MF (ZIP)。
    替换 Metadata/project_settings.config，保留其他所有文件不变。
    返回修改后的 3MF 文件字节。

    注意：此方法生成的 3MF 是"纯预设修改版"，
    可直接在 Bambu Studio 中打开并使用。
    如需完整重新切片，需通过 Client Agent 调用 BambuStudio CLI。
    """
    # 清理内部标记字段
    clean_settings = {
        k: v for k, v in modified_settings.items()
        if not k.startswith("_ai_")
    }
    new_config_bytes = json.dumps(clean_settings, ensure_ascii=False, indent=4).encode("utf-8")

    output_buf = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(original_bytes)) as src_zip:
        with zipfile.ZipFile(output_buf, "w", zipfile.ZIP_DEFLATED) as dst_zip:
            for item in src_zip.infolist():
                if item.filename == "Metadata/project_settings.config":
                    dst_zip.writestr(item.filename, new_config_bytes)
                else:
                    dst_zip.writestr(item, src_zip.read(item.filename))

    return output_buf.getvalue()


def get_3mf_object_info(file_bytes: bytes) -> dict[str, Any]:
    """
    获取 3MF 中的对象元数据（model_settings.config 的内容）。
    返回对象列表、盘面配置等信息。
    """
    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            model_config_file = "Metadata/model_settings.config"
            if model_config_file not in zf.namelist():
                return {"objects": [], "plates": []}
            raw = zf.read(model_config_file).decode("utf-8")
    except zipfile.BadZipFile:
        return {"objects": [], "plates": []}

    # 简单提取对象名称（XML解析）
    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(raw)
        objects = []
        for obj in root.findall("object"):
            obj_id = obj.get("id")
            name = ""
            for meta in obj.findall("metadata"):
                if meta.get("key") == "name":
                    name = meta.get("value", "")
                    break
            objects.append({"id": obj_id, "name": name})

        plates = []
        for plate in root.findall("plate"):
            plate_id = ""
            for meta in plate.findall("metadata"):
                if meta.get("key") == "plater_id":
                    plate_id = meta.get("value", "")
                    break
            plates.append({"id": plate_id})

        return {"objects": objects, "plates": plates}
    except ET.ParseError:
        return {"objects": [], "plates": []}
