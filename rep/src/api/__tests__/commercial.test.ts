import {describe,it,expect,vi} from "vitest";
import {createStaffApi} from "../staffApi";
describe("Assigned-retailer commercial quote",()=>{
 it("sends only SKU quantities and assigned retailer to the authoritative quote",async()=>{
  const request=vi.fn().mockResolvedValue({});const api=createStaffApi(request,{load:vi.fn(),save:vi.fn(),clear:vi.fn()});
  const items=[{variantId:"sku",qty:2}];await api.commercialQuote("assigned-retailer",items);await api.refreshCommercialQuote("quote");
  expect(request.mock.calls[0]).toEqual(["/rep/commercial/quotes",{method:"POST",body:JSON.stringify({retailerId:"assigned-retailer",items})},true]);
  expect(request.mock.calls[1]).toEqual(["/rep/commercial/quotes/quote"]);
 });
});
