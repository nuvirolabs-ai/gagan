import "express-async-errors";
import express from "express";
import request from "supertest";
import {describe,it,expect,vi,beforeEach} from "vitest";
const mocks=vi.hoisted(()=>({payment:vi.fn(),quote:vi.fn(),findQuote:vi.fn(),assigned:vi.fn(),invoice:vi.fn()}));
// Session cryptography has its own integration coverage. These route tests
// exercise authorization with server-resolved personas, never body permissions.
vi.mock("../../lib/adminAuth",()=>({
 requireAdminIdentity:(req:any,res:any,next:any)=>{if(!req.headers["x-persona"])return res.sendStatus(401);req.staffAuth={staffId:"accounts",permissions:req.headers["x-persona"]==="accounts"?["collection.confirm"]:[],stepUpUntil:req.headers["x-step-up"]?new Date(Date.now()+60000):undefined};next();},
 requireAdmin:(_req:any,res:any)=>res.sendStatus(403),
}));
vi.mock("../../lib/auth",()=>({requireAuth:(req:any,_res:any,next:any)=>{req.retailerId="retailer-a";next();}}));
vi.mock("../../lib/repAuth",()=>({requireRep:(req:any,_res:any,next:any)=>{req.repId="rep-a";next();},assignedRetailer:mocks.assigned}));
vi.mock("../../lib/prisma",()=>({prisma:{commercialQuote:{findFirst:mocks.findQuote},invoice:{findUnique:mocks.invoice}}}));
vi.mock("./payment",()=>({postInvoicePayment:mocks.payment}));
vi.mock("./service",async original=>({...await original<object>(),quoteFor:mocks.quote}));
import router from "./routes";
const app=express();app.use(express.json());app.use(router);
const body={amount:"300",jainAmount:"100",padamAmount:"200",method:"cash",reference:"LOCAL",confirmed:true};
beforeEach(()=>{vi.clearAllMocks();mocks.invoice.mockResolvedValue({id:"invoice-a",retailerId:"retailer-a"});mocks.payment.mockResolvedValue({paymentId:"payment"});mocks.findQuote.mockResolvedValue(null);mocks.assigned.mockResolvedValue(false);});
describe("commercial route security and exact invoice scope",()=>{
 it("rejects missing session, unrelated role, and missing step-up before payment service",async()=>{
  expect((await request(app).post("/admin/commercial/invoices/invoice-a/payments").send(body)).status).toBe(401);
  expect((await request(app).post("/admin/commercial/invoices/invoice-a/payments").set("x-persona","sales").send({...body,permissions:["collection.confirm"]})).status).toBe(403);
  expect((await request(app).post("/admin/commercial/invoices/invoice-a/payments").set("x-persona","accounts").send(body)).status).toBe(403);
  expect(mocks.payment).not.toHaveBeenCalled();
 });
 it("takes invoice from the protected URL and actor from session, not the submitted body",async()=>{
  const response=await request(app).post("/admin/commercial/invoices/invoice-a/payments").set("x-persona","accounts").set("x-step-up","yes").set("idempotency-key","key").send({...body,invoiceId:"unrelated-invoice",actorStaffId:"spoof"});
  expect(response.status).toBe(200);expect(mocks.payment).toHaveBeenCalledWith("retailer-a","accounts","key",{...body,invoiceId:"invoice-a"});
 });
 it("rejects unconfirmed payment and precision beyond paise",async()=>{
  for(const patch of [{confirmed:false},{amount:"300.001"}])expect((await request(app).post("/admin/commercial/invoices/invoice-a/payments").set("x-persona","accounts").set("x-step-up","yes").send({...body,...patch})).status).toBe(400);
  expect(mocks.payment).not.toHaveBeenCalled();
 });
 it("restricts quote reads to retailer ownership and rep creation to assigned retailers",async()=>{
  expect((await request(app).get("/commercial/quotes/other-quote")).status).toBe(404);
  expect(mocks.findQuote).toHaveBeenCalledWith({where:{id:"other-quote",retailerId:"retailer-a"}});
  expect((await request(app).post("/rep/commercial/quotes").send({retailerId:"unassigned",items:[{variantId:"sku",qty:1}]})).status).toBe(404);
  expect(mocks.quote).not.toHaveBeenCalled();
 });
});
