export interface RevenueData {
  month: string;
  revenue: number;
  target: number;
}

export interface QuotationTrendData {
  month: string;
  created: number;
  approved: number;
  rejected: number;
}

export interface ProcessingMetric {
  category: string;
  processed: number;
  total: number;
  percentage: number;
  color: string;
}

export interface QuotationRequestCounts {
  totalCount: number;
  pendingCount: number;
  processedCount: number;
  failedCount: number;
  requests: {
    id: string;
    requester: string;
    email: string;
    description: string;
    status: string;
    createdAt: string;
    priority?: string;
    processedAt?: string;
    quotationId?: string;
  }[];
}
