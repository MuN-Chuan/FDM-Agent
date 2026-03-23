"""
threemf_service.py — 3MF 文件解析、修改与 CLI payload 生成服务

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

# ─── 参数同步映射 (Printer <-> Filament) ───────────────────────────────
# 当修改左侧主参数时，如果右侧对应的耗材覆盖参数为 "nil"，则同步更新它。
# 这确保了在切片软件 UI 的“耗材”页签中也能看到对应的修改。
_PARAMETER_SYNC_MAP = {
    "retraction_length": "filament_retraction_length",
    "retraction_speed": "filament_retraction_speed",
    "deretraction_speed": "filament_deretraction_speed",
    "retraction_minimum_travel": "filament_retraction_minimum_travel",
    "retract_when_changing_layer": "filament_retract_when_changing_layer",
    "wipe": "filament_wipe",
    "wipe_distance": "filament_wipe_distance",
    "retract_before_wipe": "filament_retract_before_wipe",
    "z_hop": "filament_z_hop",
    "z_hop_types": "filament_z_hop_types",
}


def _normalize_filament_ids(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item not in (None, "")]
    if value in (None, ""):
        return []
    return [str(value)]


def _build_cli_user_preset(
    *,
    preset_type: str,
    name: str,
    inherits: str,
    overrides: dict[str, Any],
    setting_id: str | None = None,
    filament_id: str | None = None,
    compatible_printers: list[str] | None = None,
) -> dict[str, Any] | None:
    if not inherits or not overrides:
        return None

    preset: dict[str, Any] = {
        "type": preset_type,
        "name": name,
        "from": "user",
        "instantiation": "true",
        "inherits": inherits,
    }

    if setting_id:
        preset["setting_id"] = setting_id
    if filament_id:
        preset["filament_id"] = filament_id
    if compatible_printers:
        preset["compatible_printers"] = compatible_printers

    preset.update(copy.deepcopy(overrides))
    return preset


def _merge_marker_list(value: Any, added_keys: list[str]) -> list[str]:
    existing: list[str] = []
    target_len = 3

    if isinstance(value, list):
        target_len = max(len(value), 1)
        existing = [str(item) for item in value if item not in (None, "")]
    elif value not in (None, ""):
        existing = [str(value)]
        target_len = 1

    merged: list[str] = []
    for item in [str(key) for key in added_keys if key] + existing:
        if item and item not in merged:
            merged.append(item)

    target_len = max(target_len, len(merged), 1)
    result = merged[:target_len]
    while len(result) < target_len:
        result.append("")
    return result


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

    # --- 步骤 2: 参数同步 (Printer -> Filament) ---
    # 如果修改了主参数且对应耗材参数为 "nil" 或不存在，则补全它
    for main_key, sync_key in _PARAMETER_SYNC_MAP.items():
        if main_key in applied and sync_key in result:
            main_val = result[main_key]
            sync_val = result[sync_key]
            
            # 如果耗材层级是 "nil" (继承自打印机)，则强制覆盖为新值以确保 UI 显示
            # 或者如果 sync_key 在 applied 中没出现 (AI 没直接改它)
            if sync_val == ["nil"] or sync_key not in applied:
                result[sync_key] = copy.deepcopy(main_val)
                if sync_key not in applied:
                    applied.append(sync_key)

    result["_ai_modifications_applied"] = applied
    result["_ai_modifications_skipped"] = skipped
    return result


def build_cli_override_payload(
    job_id: str,
    settings: dict[str, Any],
    modified_settings: dict[str, Any],
    modifications: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Build a client-agent payload for Bambu Studio CLI export.

    The CLI does not consume a flat project_settings.config. It expects
    user-style machine / process / filament preset JSON files passed via
    --load_settings and --load_filaments. This helper converts the AI's
    category-based modifications into those override preset files.
    """
    applied_keys = set(modified_settings.get("_ai_modifications_applied", []))
    printer_settings_id = str(settings.get("printer_settings_id", "") or "")
    print_settings_id = str(settings.get("print_settings_id", "") or "")
    filament_settings_ids = _normalize_filament_ids(settings.get("filament_settings_id"))

    printer_overrides: dict[str, Any] = {}
    process_overrides: dict[str, Any] = {}
    filament_overrides: dict[str, Any] = {}

    for mod in modifications:
        key = str(mod.get("name", "") or "")
        category = str(mod.get("category", "") or "")
        if not key or key not in applied_keys or key not in modified_settings:
            continue

        value = copy.deepcopy(modified_settings[key])
        if category == "printer":
            printer_overrides[key] = value
        elif category == "process":
            process_overrides[key] = value
        elif category == "filament":
            filament_overrides[key] = value

    compatible_printers = [printer_settings_id] if printer_settings_id else None
    machine_preset = _build_cli_user_preset(
        preset_type="machine",
        name=f"FDM-AI Machine Override {job_id[:8]}",
        inherits=printer_settings_id,
        overrides=printer_overrides,
        setting_id=f"FDM-AI-M-{job_id[:8]}",
    )
    process_preset_overrides = copy.deepcopy(process_overrides)
    if process_preset_overrides:
        process_preset_overrides["different_settings_to_system"] = _merge_marker_list(
            settings.get("different_settings_to_system"),
            list(process_overrides.keys()),
        )
    process_preset = _build_cli_user_preset(
        preset_type="process",
        name=print_settings_id or f"FDM-AI Process Override {job_id[:8]}",
        inherits=print_settings_id,
        overrides=process_preset_overrides,
        compatible_printers=compatible_printers,
    )

    filament_presets: list[dict[str, Any]] = []
    if filament_overrides:
        base_filament_ids = filament_settings_ids or [""]
        for index, base_id in enumerate(base_filament_ids):
            inherits = base_id
            if not inherits:
                continue
            filament_presets.append(
                _build_cli_user_preset(
                    preset_type="filament",
                    name=f"FDM-AI Filament Override {job_id[:8]} #{index + 1}",
                    inherits=inherits,
                    overrides=filament_overrides,
                    setting_id=f"FDM-AI-FS-{job_id[:8]}-{index + 1}",
                    filament_id=f"FDM-AI-F-{job_id[:8]}-{index + 1}",
                    compatible_printers=compatible_printers,
                )
            )
        filament_presets = [preset for preset in filament_presets if preset]

    return {
        "job_id": job_id,
        "printer_settings_id": printer_settings_id,
        "print_settings_id": print_settings_id,
        "filament_settings_ids": filament_settings_ids,
        "machine_preset": machine_preset,
        "process_preset": process_preset,
        "filament_presets": filament_presets,
        "applied_keys": sorted(applied_keys),
        "output_name": f"optimized_{job_id[:8]}.3mf",
    }


def normalize_cli_export_3mf(
    original_bytes: bytes,
    exported_bytes: bytes,
) -> bytes:
    """
    Normalize Bambu Studio CLI export artifacts that do not appear in the
    equivalent manual GUI export for the same source project.

    The CLI may inject inheritance bookkeeping such as `inherits_group`,
    `filament_map_2`, or `gcode_file`. Those fields can confuse later re-import
    even though the real process values were already exported correctly.
    """
    import xml.etree.ElementTree as ET

    removable_project_keys = {"inherits_group", "filament_map_2"}
    removable_model_metadata_keys = {"gcode_file"}

    try:
        with zipfile.ZipFile(io.BytesIO(original_bytes)) as original_zip:
            original_project = json.loads(
                original_zip.read("Metadata/project_settings.config").decode("utf-8")
            )
            original_model_root = ET.fromstring(
                original_zip.read("Metadata/model_settings.config").decode("utf-8")
            )
    except Exception:
        return exported_bytes

    try:
        with zipfile.ZipFile(io.BytesIO(exported_bytes)) as exported_zip:
            exported_project = json.loads(
                exported_zip.read("Metadata/project_settings.config").decode("utf-8")
            )
            exported_model_root = ET.fromstring(
                exported_zip.read("Metadata/model_settings.config").decode("utf-8")
            )
    except Exception:
        return exported_bytes

    changed_project = False
    normalized_project = copy.deepcopy(exported_project)
    for key in removable_project_keys:
        if key not in original_project and key in normalized_project:
            normalized_project.pop(key, None)
            changed_project = True

    original_model_keys = {
        meta.get("key")
        for meta in original_model_root.findall(".//metadata")
        if meta.get("key")
    }
    removable_model_keys = {
        key for key in removable_model_metadata_keys if key not in original_model_keys
    }
    changed_model = False
    if removable_model_keys:
        for parent in exported_model_root.iter():
            for child in list(parent):
                if child.tag != "metadata":
                    continue
                key = child.get("key")
                if key in removable_model_keys:
                    parent.remove(child)
                    changed_model = True

    if not changed_project and not changed_model:
        return exported_bytes

    project_bytes = None
    if changed_project:
        project_text = json.dumps(normalized_project, ensure_ascii=False, indent=4)
        project_bytes = project_text.replace("\n", "\r\n").encode("utf-8")

    model_bytes = None
    if changed_model:
        model_xml = ET.tostring(
            exported_model_root,
            encoding="utf-8",
            xml_declaration=False,
        )
        model_bytes = b'<?xml version="1.0" encoding="UTF-8"?>\n' + model_xml

    output_buf = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(exported_bytes)) as src_zip:
        with zipfile.ZipFile(output_buf, "w", zipfile.ZIP_DEFLATED) as dst_zip:
            for item in src_zip.infolist():
                if item.filename == "Metadata/project_settings.config" and project_bytes is not None:
                    dst_zip.writestr(item.filename, project_bytes)
                elif item.filename == "Metadata/model_settings.config" and model_bytes is not None:
                    dst_zip.writestr(item.filename, model_bytes)
                else:
                    dst_zip.writestr(item, src_zip.read(item.filename))

    return output_buf.getvalue()


def repack_3mf(
    original_bytes: bytes,
    modified_settings: dict[str, Any],
) -> bytes:
    """
    Produce modified 3MF bytes by updating internal config files.
    - project_settings.config (global)
    - plate_*.json (per-plate/object overrides)
    """
    applied_keys = modified_settings.get("_ai_modifications_applied", [])
    
    clean_settings = {
        k: v for k, v in modified_settings.items()
        if not k.startswith("_ai_")
    }
    # Bambu Studio strictly uses CRLF (\r\n) and 4-space indent for project_settings.config
    json_str = json.dumps(clean_settings, ensure_ascii=False, indent=4)
    json_str = json_str.replace('\n', '\r\n')
    new_config_bytes = json_str.encode("utf-8")

    output_buf = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(original_bytes)) as src_zip:
        with zipfile.ZipFile(output_buf, "w", zipfile.ZIP_DEFLATED) as dst_zip:
            for item in src_zip.infolist():
                filename = item.filename
                
                if filename == "Metadata/project_settings.config":
                    dst_zip.writestr(filename, new_config_bytes)
                
                elif filename == "Metadata/model_settings.config":
                    # Model settings config is XML-based and contains object-level metadata overrides
                    try:
                        import xml.etree.ElementTree as ET
                        xml_content = src_zip.read(filename).decode("utf-8")
                        root = ET.fromstring(xml_content)
                        
                        modified_xml = False
                        for meta in root.findall(".//metadata"):
                            key = meta.get("key")
                            if key and key in applied_keys:
                                new_val = modified_settings[key]
                                if isinstance(new_val, list) and len(new_val) > 0:
                                    new_val = new_val[0]
                                
                                meta.set("value", str(new_val))
                                modified_xml = True
                        
                        if modified_xml:
                            new_xml_raw = ET.tostring(root, encoding="utf-8", xml_declaration=False)
                            new_xml_header = b'<?xml version="1.0" encoding="UTF-8"?>\n'
                            new_xml_bytes = new_xml_header + new_xml_raw
                            dst_zip.writestr(filename, new_xml_bytes)
                        else:
                            dst_zip.writestr(item, src_zip.read(filename))
                    except Exception as e:
                        print(f"[Repack] Error processing XML {filename}: {e}")
                        dst_zip.writestr(item, src_zip.read(filename))

                elif filename.startswith("Metadata/") and (filename.endswith(".json") or filename.endswith(".config")):
                    # 统一处理 Metadata 下的其他配置信息 (如 plate_*.json, filament_settings_*.config 等)
                    is_json = filename.endswith(".json") or "settings" in filename or "profile" in filename
                    
                    try:
                        raw_data = src_zip.read(filename).decode("utf-8")
                        
                        # 尝试作为 JSON 处理 (大多数 Bambu 配置是 JSON)
                        if is_json:
                            try:
                                data = json.loads(raw_data)
                                modified = False
                                
                                # 1. 顶层键值对更新
                                for key in applied_keys:
                                    if key in data:
                                        new_val = modified_settings[key]
                                        # 类型转换参考 plate_*.json 逻辑
                                        if isinstance(data[key], (int, float)) and isinstance(new_val, list) and len(new_val) > 0:
                                            try:
                                                stripped = str(new_val[0]).rstrip('%')
                                                data[key] = float(stripped)
                                            except ValueError:
                                                data[key] = new_val[0]
                                        else:
                                            data[key] = new_val
                                        modified = True
                                
                                # 2. 盘面对象级更新 (bbox_objects)
                                if "bbox_objects" in data:
                                    for obj in data["bbox_objects"]:
                                        for key in applied_keys:
                                            if key in obj:
                                                new_val = modified_settings[key]
                                                if isinstance(new_val, list) and len(new_val) > 0:
                                                    new_val = new_val[0]
                                                
                                                if isinstance(obj[key], (int, float)) and isinstance(new_val, str):
                                                    try:
                                                        new_val = float(new_val.rstrip('%'))
                                                    except ValueError: pass
                                                
                                                obj[key] = new_val
                                                modified = True
                                
                                if modified:
                                    # 针对不同文件保持缩进风格
                                    indent = 4 if filename == "Metadata/project_settings.config" else None
                                    separators = (',', ': ') if indent else (',', ':')
                                    new_bytes = json.dumps(data, ensure_ascii=False, indent=indent, separators=separators).encode("utf-8")
                                    if indent:
                                        new_bytes = new_bytes.replace(b'\n', b'\r\n')
                                    dst_zip.writestr(filename, new_bytes)
                                else:
                                    dst_zip.writestr(item, src_zip.read(filename))
                                continue
                            except json.JSONDecodeError:
                                pass # 不是 JSON，跳过
                                
                        # 如果不是 JSON 或处理失败，按原样写入
                        dst_zip.writestr(item, src_zip.read(filename))
                    except Exception as e:
                        print(f"[Repack] Error processing {filename}: {e}")
                        dst_zip.writestr(item, src_zip.read(filename))

                else:
                    dst_zip.writestr(item, src_zip.read(filename))

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
