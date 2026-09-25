import {describe,it,expect,vi} from "vitest";
import {createRetailerApi} from "../retailerApi";

describe("retailer invoice-scoped payment request",()=>{
 it("sends the selected invoice and exact Jain/Padam split with the provider amount",async()=>{
  const request=vi.fn().mockResolvedValue({});
  const api=createRetailerApi(request,{load:vi.fn(),save:vi.fn(),clear:vi.fn()});
  const idempotencyKey="retailer-payment-attempt-1";

  await api.createPaymentIntent(100,idempotencyKey,{
   invoiceScopeId:"2f45d62b-30db-4c16-8bd0-c18871f4aa74",
   jainAmount:60,
   padamAmount:40,
  });

  expect(request.mock.calls[0]).toEqual([
   "/payments/intent",
   {method:"POST",headers:{"Idempotency-Key":idempotencyKey},body:JSON.stringify({amount:100,invoiceScopeId:"2f45d62b-30db-4c16-8bd0-c18871f4aa74",jainAmount:60,padamAmount:40})},
   true,
  ]);
 });
});
