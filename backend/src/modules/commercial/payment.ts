import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { settleSucceededPayment } from "../payments/paymentService";
import { CommercialError } from "./service";

export interface ConfirmedPayment {
  invoiceId:string; amount:string; jainAmount:string; padamAmount:string;
  method:string; reference:string; confirmed:true;
}
function amount(value:string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new CommercialError("invalid_payment_precision",400);
  return new Prisma.Decimal(value);
}
export async function postInvoicePayment(retailerId:string,actorStaffId:string,key:string,input:ConfirmedPayment) {
  const total=amount(input.amount), jain=amount(input.jainAmount),padam=amount(input.padamAmount);
  if (!input.invoiceId || !key || key.length>120 || !input.confirmed || !total.isPositive() || !jain.plus(padam).eq(total) || !input.method.trim() || !input.reference.trim()) throw new CommercialError("explicit_invoice_allocation_required",400);
  const target=await prisma.invoice.findFirst({where:{id:input.invoiceId,retailerId}});
  if (!target) throw new CommercialError("invoice_not_found",404);
  const fingerprint=createHash("sha256").update(JSON.stringify({retailerId,actorStaffId,invoiceId:input.invoiceId,amount:total.toFixed(2),jain:jain.toFixed(2),padam:padam.toFixed(2),method:input.method.trim(),reference:input.reference.trim()})).digest("hex");
  // Persist the confirmed intent before settlement. A failed/timeout settlement
  // is safely resumable with this exact intent, never a different allocation.
  const payment=await prisma.payment.upsert({where:{requestKey:key},update:{},create:{
    retailerId,amount:total,channel:"manual",invoiceScopeId:input.invoiceId,confirmedJainAmount:jain,confirmedPadamAmount:padam,
    confirmedByStaffId:actorStaffId,confirmedMethod:input.method.trim(),confirmedReference:input.reference.trim(),requestKey:key,requestFingerprint:fingerprint,
  }}).catch(async error=>{
    if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2002") {
      const existing=await prisma.payment.findUnique({where:{requestKey:key}});
      if(existing)return existing;
    }
    throw error;
  });
  if (payment.requestFingerprint!==fingerprint) throw new CommercialError("payment_idempotency_conflict");
  return settleSucceededPayment({paymentId:payment.id,occurredAt:payment.createdAt});
}
