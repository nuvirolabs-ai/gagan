import { ServiceIssueStatus, type PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { prisma } from "../../lib/prisma";

const MAX_EXPORT_ROWS = 5_000;

export class ExportError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

export interface ServiceIssueExportFilters {
  status?: ServiceIssueStatus;
  retailerId?: string;
  salespersonId?: string;
  from?: string;
  through?: string;
  scopeStaffIds: string[] | null;
}

function safeCellText(value: string): string {
  return /^(?:[\t\r]|[\s\uFEFF]*[=+\-@])/u.test(value) ? `'${value}` : value;
}

export class ServiceIssueExportService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async excel(filters: ServiceIssueExportFilters): Promise<Buffer> {
    const issues = await this.db.serviceIssue.findMany({
      where: {
        ...(filters.scopeStaffIds === null ? {} : { OR: [
          { raisedByStaffId: { in: filters.scopeStaffIds } },
          { raisedByStaffId: null, retailer: { salesRep: { staffUser: { id: { in: filters.scopeStaffIds } } } } },
        ] }),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.retailerId ? { retailerId: filters.retailerId } : {}),
        ...(filters.salespersonId ? { raisedByStaffId: filters.salespersonId } : {}),
        ...((filters.from || filters.through) ? { createdAt: {
          ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
          ...(filters.through ? { lte: new Date(`${filters.through}T23:59:59.999Z`) } : {}),
        } } : {}),
      },
      select: {
        id: true, createdAt: true, retailerId: true, retailer: { select: { name: true } },
        raisedByStaffId: true, raisedBy: { select: { name: true } }, type: true, priority: true,
        description: true, status: true, assignedTeam: true, resolutionNote: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: MAX_EXPORT_ROWS + 1,
    });
    if (issues.length > MAX_EXPORT_ROWS) throw new ExportError("export_too_large", 413);
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Created at", "Retailer", "Retailer ID", "Type", "Priority", "Raised by", "Description", "Status", "Assigned team", "Resolution note"],
      ...issues.map((issue) => [
        issue.createdAt.toISOString(), safeCellText(issue.retailer.name), issue.retailerId, issue.type, issue.priority,
        safeCellText(issue.raisedBy?.name ?? (issue.raisedByStaffId ? "Staff unavailable" : "Retailer")),
        safeCellText(issue.description), issue.status, safeCellText(issue.assignedTeam ?? ""),
        safeCellText(issue.resolutionNote ?? ""),
      ]),
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Service issues");
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  }
}

export const defaultServiceIssueExportService = new ServiceIssueExportService();
