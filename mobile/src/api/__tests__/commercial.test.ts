import {describe,it,expect,vi} from "vitest";
import {createRetailerApi} from "../retailerApi";
describe("Commercial quote boundary",()=>{
 it("requests a server quote and submits its identity rather than client money",async()=>{
  const request=vi.fn().mockResolvedValue({});const api=createRetailerApi(request,{load:vi.fn(),save:vi.fn(),clear:vi.fn()});
  const items=[{variantId:"sku",qty:2}];
  await api.commercialQuote(items);await api.refreshCommercialQuote("quote");await api.createOrder(items,"stable-key",{quoteId:"quote",revision:2});
  expect(request.mock.calls[0]).toEqual(["/commercial/quotes",{method:"POST",body:JSON.stringify({items})},true]);
  expect(request.mock.calls[1]).toEqual(["/commercial/quotes/quote"]);
  expect(JSON.parse(request.mock.calls[2][1].body)).toEqual({items,commercial:{quoteId:"quote",revision:2}});
  expect(request.mock.calls[2][1].headers["Idempotency-Key"]).toBe("stable-key");
 });
});
