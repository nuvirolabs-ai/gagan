export type ServiceRequestRow = {
  id: string;
  description: string;
  status: string;
  createdAt: string;
  withdrawnAt?: string | null;
};

export function canWithdrawServiceRequest(request: ServiceRequestRow): boolean {
  return request.status === "open";
}

export function mergeServiceRequest(rows: ServiceRequestRow[], updated: ServiceRequestRow): ServiceRequestRow[] {
  return rows.map((row) => row.id === updated.id ? { ...row, ...updated } : row);
}
