import React from 'react';
import { ArrowRight, Info, AlertTriangle } from 'lucide-react';

export interface ParameterModification {
    name: string;
    old: string;
    new: string;
    range: string;
    reason: string;
    risk: 'low' | 'medium' | 'high';
}

const PARAMETER_NAME_MAP: Record<string, string> = {
    // Basic settings
    "nozzle_temperature": "喷嘴温度",
    "nozzle_temperature_initial_layer": "首层喷嘴温度",
    "bed_temperature": "热床温度",
    "bed_temperature_initial_layer": "首层热床温度",
    "layer_height": "层高",
    "initial_layer_print_height": "首层层高",
    
    // Retraction
    "retraction_length": "回抽长度",
    "retraction_speed": "回抽速度",
    "deretraction_speed": "回抽恢复速度",
    "retract_before_wipe": "擦拭前回抽",
    "retraction_minimum_travel": "最小回抽距离",
    "z_hop": "抬升高度 (Z-Hop)",
    "wipe_on_loops": "循环擦拭",
    
    // Speed (Advanced)
    "outer_wall_speed": "外墙速度",
    "inner_wall_speed": "内墙速度",
    "sparse_infill_speed": "填充速度",
    "internal_solid_infill_speed": "内部实心填充速度",
    "top_surface_speed": "顶面浏览速度",
    "gap_fill_speed": "间隙填充速度",
    "travel_speed": "空驶速度",
    "initial_layer_speed": "首层打印速度",
    "initial_layer_infill_speed": "首层填充速度",
    "bridge_speed": "桥接速度",
    "overhang_1_4_speed": "10%-25% 悬空速度",
    "overhang_2_4_speed": "25%-50% 悬空速度",
    "overhang_3_4_speed": "50%-75% 悬空速度",
    "overhang_4_4_speed": "75%-100% 悬空速度",
    
    // Shell & Infill
    "wall_loops": "墙线圈数",
    "top_shell_layers": "顶部外壳层数",
    "bottom_shell_layers": "底部外壳层数",
    "sparse_infill_density": "填充密度",
    "sparse_infill_pattern": "填充模式",
    "top_surface_pattern": "顶面填充模式",
    "bottom_surface_pattern": "底面填充模式",
    
    // Cooling
    "fan_speed_min": "最小风扇速度",
    "fan_speed_max": "最大风扇速度",
    "cool_plate_temp": "底板温度",
    "bridge_fan_speed": "桥接风扇速度",
    
    // Support
    "enable_support": "启用支撑",
    "support_type": "支撑类型",
    "support_style": "支撑风格",
    "support_on_build_plate_only": "仅在底板生成支撑",
    "support_top_z_distance": "支撑顶部 Z 距离",
    "support_bottom_z_distance": "支撑底部 Z 距离",
    "support_xy_distance": "支撑 XY 距离",
    "support_interface_layers": "支撑界面层数",
    
    // Others
    "filament_flow_ratio": "流量比例",
    "skirt_distance": "裙边距离",
    "skirt_loops": "裙边圈数",
    "brim_width": "底座宽度",
    "brim_type": "底座类型",
    "prime_tower_enable": "启用擦拭塔",
    "ironing_type": "熨烫模式",
    "ironing_speed": "熨烫速度",
    "ironing_flow": "熨烫流量",
};

interface ParameterDiffViewerProps {
    modifications?: ParameterModification[];
}

export const ParameterDiffViewer: React.FC<ParameterDiffViewerProps> = ({ modifications = [] }) => {
    const getFriendlyName = (key: string) => {
        return PARAMETER_NAME_MAP[key] || key;
    };
    if (modifications.length === 0) {
        return (
            <div className="p-8 text-center text-text-light/30 border border-dashed border-secondary/10 rounded-xl bg-secondary/5">
                <Info size={24} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">暂无参数修改建议。对于简单的诊断，可能不需要修改预设文件。</p>
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-secondary/10">
            <table className="w-full text-left border-collapse">
                <thead className="bg-secondary/5 text-[10px] font-bold uppercase tracking-widest text-text-light/40">
                    <tr>
                        <th className="px-6 py-4">参数名称</th>
                        <th className="px-6 py-4">更改对比 (Diff)</th>
                        <th className="px-6 py-4">风险等级</th>
                        <th className="px-6 py-4">修改理由</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-secondary/5">
                    {modifications.map((item) => (
                        <tr key={item.name} className="hover:bg-secondary/5 transition-colors group">
                            <td className="px-6 py-4">
                                <p className="text-sm font-bold text-text-light mb-1">{getFriendlyName(item.name)}</p>
                                <code className="text-[10px] font-mono bg-secondary/5 px-1.5 py-0.5 rounded text-text-light/30">{item.name}</code>
                            </td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs line-through text-text-light/30">{item.old}</span>
                                    <ArrowRight size={14} className="text-cta" />
                                    <span className="text-xs font-bold text-cta bg-cta/10 px-2 py-0.5 rounded">{item.new}</span>
                                </div>
                                <p className="text-[10px] text-text-light/40 mt-1.5">安全区间: {item.range}</p>
                            </td>
                            <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase ${item.risk === 'low' ? 'bg-green-500/10 text-green-500' :
                                        item.risk === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                                            'bg-red-500/10 text-red-500'
                                    }`}>
                                    {item.risk === 'low' ? <Info size={12} /> : <AlertTriangle size={12} />}
                                    {item.risk === 'low' ? '低风险' : item.risk === 'medium' ? '中风险' : '高风险'}
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <p className="text-xs text-text-light/60 max-w-[300px] leading-relaxed">
                                    {item.reason}
                                </p>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
