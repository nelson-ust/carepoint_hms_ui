export interface VisitFlowStep {
  id: number;
  template_id: number;
  service_delivery_point_id: number;
  service_delivery_point_name: string;
  step_order: number;
  notes: string | null;
}

export interface VisitFlowTemplate {
  id: number;
  name: string;
  code: string;
  description: string;
  associated_visit_flow_templates_steps: VisitFlowStep[];
}

export interface VisitFlowTemplatesResponse {
  success: boolean;
  message: string;
  items: VisitFlowTemplate[];
  count: number;
  meta: {
    total: number;
    skip: number;
    limit: number;
    current_page: number;
    page_size: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
    next_skip: number | null;
    previous_skip: number | null;
  };
}
