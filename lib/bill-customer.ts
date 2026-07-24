import { Bill, Customer } from "../types";

export type BillCustomerDetails = {
  customerName: string;
  customerMobile: string;
  customerLocation?: string;
  customerState?: string;
};

export function resolveBillCustomer(
  bill: Bill,
  customerMap: Map<string, Customer>,
  fallbackName = "Unknown Customer"
): BillCustomerDetails {
  const live = customerMap.get(bill.customerId);

  return {
    customerName: bill.customerName ?? live?.name ?? fallbackName,
    customerMobile: bill.customerMobile ?? live?.mobile ?? "",
    customerLocation: bill.customerLocation ?? live?.location,
    customerState: bill.customerState ?? live?.state,
  };
}

export function customerSnapshotFromCustomer(customer: Customer | undefined) {
  if (!customer) return {};
  return {
    customerName: customer.name,
    customerMobile: customer.mobile,
    customerLocation: customer.location,
    customerState: customer.state,
  };
}
