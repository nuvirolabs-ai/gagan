import {beforeEach,describe,it,expect,vi} from "vitest";
import {render,screen,fireEvent,waitFor} from "@testing-library/react";
import Commercial from "../Commercial";

const mocks=vi.hoisted(()=>({commercial:vi.fn(),commercialBalances:vi.fn(),commercialPayment:vi.fn(),permissions:["collection.confirm"]}));
vi.mock("../../useAuth",()=>({useAuth:()=>({permissions:mocks.permissions})}));
vi.mock("../../api",()=>({api:mocks}));
const invoice={id:"invoice-specific",invoiceNumber:42,total:"5508",outstandingAmount:"5208",allocations:[],commercialSnapshot:{lines:[],freight:null,total:"5508",entities:[]}};
beforeEach(()=>{
 vi.clearAllMocks();mocks.permissions=["collection.confirm"];
 mocks.commercial.mockResolvedValue({variants:[],tiers:[],quotes:[],invoices:[invoice]});
 mocks.commercialBalances.mockResolvedValue({invoiceId:invoice.id,jain:"3168.00",padam:"2040.00",total:"5208.00"});
 mocks.commercialPayment.mockResolvedValue({});
});
async function openInvoice(){render(<Commercial/>);fireEvent.click(await screen.findByText(/Invoice #42/));fireEvent.click(screen.getByText("Load this invoice’s balances"));await screen.findByText("Jain ₹3168.00 · Padam ₹2040.00");}
describe("Invoice-specific company allocation",()=>{
 it("keeps Accounts out of SKU/freight configuration and loads only the selected invoice",async()=>{
  await openInvoice();expect(screen.queryByText("Configure SKU")).toBeNull();expect(mocks.commercialBalances).toHaveBeenCalledWith(invoice.id);
 });
 it("prefills full invoice balances but requires a fresh confirmation after any edit",async()=>{
  await openInvoice();fireEvent.click(screen.getByText("Prefill full payment (confirmation still required)"));
  expect(screen.getByLabelText("Payment received")).toHaveValue(5208);
  expect(screen.getByLabelText("Jain allocation")).toHaveValue(3168);
  expect(screen.getByLabelText("Padam allocation")).toHaveValue(2040);
  expect(screen.getByText("Confirm payment")).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));expect(screen.getByText("Confirm payment")).not.toBeDisabled();
  fireEvent.change(screen.getByLabelText("Jain allocation"),{target:{value:"100"}});
  expect(screen.getByRole("checkbox")).not.toBeChecked();expect(screen.getByText("Confirm payment")).toBeDisabled();
 });
 it("submits the explicit split, invoice id and retry identity without proportional allocation",async()=>{
  await openInvoice();
  fireEvent.change(screen.getByLabelText("Payment received"),{target:{value:"300"}});
  fireEvent.change(screen.getByLabelText("Jain allocation"),{target:{value:"100"}});
  fireEvent.change(screen.getByLabelText("Padam allocation"),{target:{value:"200"}});
  fireEvent.change(screen.getByLabelText("Reference"),{target:{value:"UAT-RECEIPT"}});
  fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByText("Confirm payment"));
  await waitFor(()=>expect(mocks.commercialPayment).toHaveBeenCalledWith(invoice.id,expect.any(String),expect.objectContaining({amount:"300",jainAmount:"100",padamAmount:"200",reference:"UAT-RECEIPT",confirmed:true})));
 });
});
