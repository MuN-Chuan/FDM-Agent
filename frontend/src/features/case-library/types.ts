export interface CaseListItem {
    case_id: string;
    slug?: string;
    title: string;
    defect_category: string;
    printer_model?: string;
    filament_material?: string;
    solution_summary?: string;
    cover_image?: string;
}

export interface CaseListResponse {
    items: CaseListItem[];
    count: number;
}

export interface CaseFilters {
    defect_category: string;
    printer_model: string;
    filament_material: string;
    query: string;
}
