import { Customer, Bill, Settings } from "../types";

export const defaultSettings: Settings = {
  hourlyRate: 1200,
  businessName: "My Business",
  businessAddress: "",
  phoneNumber: "",
  gstNumber: "",
  invoicePrefix: "INV-",
  nextInvoiceNumber: 1,
  invoiceNumberDigits: 5,
  highestUsedInvoiceNumber: 0,
  latestInvoiceNumber: null,
  currencySymbol: "₹",
  defaultTax: 0,
  invoiceNotes: "",
  footerText: "",
  hsnCode: "",
  logoUrl: null,
  signatureUrl: null,
};

export const mockCustomers: Customer[] = [
  { id: "cust-1", name: "Rajesh Gowda", mobile: "9845012345", location: "Hebbal", state: "Karnataka", notes: "Regular customer for harvesting", createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000 },
  { id: "cust-2", name: "Suresh Kumar", mobile: "9845012346", location: "Bidadi", state: "Karnataka", notes: "Requires tractor attachment always", createdAt: Date.now() - 29 * 24 * 60 * 60 * 1000 },
  { id: "cust-3", name: "Ramesh Patil", mobile: "9845012347", location: "Nelamangala", state: "Karnataka", notes: "", createdAt: Date.now() - 28 * 24 * 60 * 60 * 1000 },
  { id: "cust-4", name: "Ramesh Naik", mobile: "9845012348", location: "Devanahalli", state: "Karnataka", notes: "Prefers morning slots", createdAt: Date.now() - 27 * 24 * 60 * 60 * 1000 },
  { id: "cust-5", name: "Vijay Dev", mobile: "9845012349", location: "Hoskote", state: "Karnataka", notes: "", createdAt: Date.now() - 26 * 24 * 60 * 60 * 1000 },
  { id: "cust-6", name: "Anand Rao", mobile: "9845012350", location: "Malur", state: "Karnataka", notes: "Pays immediately by cash", createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000 },
  { id: "cust-7", name: "Sunil Hegde", mobile: "9845012351", location: "Ramanagara", state: "Karnataka", notes: "", createdAt: Date.now() - 24 * 24 * 60 * 60 * 1000 },
  { id: "cust-8", name: "Mahesh Prasad", mobile: "9845012352", location: "Kanakapura", state: "Karnataka", notes: "Negotiates on transport charge", createdAt: Date.now() - 23 * 24 * 60 * 60 * 1000 },
  { id: "cust-9", name: "Venkatesh M", mobile: "9845012353", location: "Doddaballapura", state: "Karnataka", notes: "", createdAt: Date.now() - 22 * 24 * 60 * 60 * 1000 },
  { id: "cust-10", name: "Somanna Gowda", mobile: "9845012354", location: "Magadi", state: "Karnataka", notes: "Prefers UPI payments", createdAt: Date.now() - 21 * 24 * 60 * 60 * 1000 },
  { id: "cust-11", name: "Gurupadappa", mobile: "9845012355", location: "Channapatna", state: "Karnataka", notes: "", createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000 },
  { id: "cust-12", name: "Manjunath K", mobile: "9845012356", location: "Kengeri", state: "Karnataka", notes: "Sowing operations only", createdAt: Date.now() - 19 * 24 * 60 * 60 * 1000 },
  { id: "cust-13", name: "Shivashankar", mobile: "9845012357", location: "Yelahanka", state: "Karnataka", notes: "", createdAt: Date.now() - 18 * 24 * 60 * 60 * 1000 },
  { id: "cust-14", name: "Basavaraj", mobile: "9845012358", location: "Whitefield", state: "Karnataka", notes: "Needs invoices sent on WhatsApp", createdAt: Date.now() - 17 * 24 * 60 * 60 * 1000 },
  { id: "cust-15", name: "Apparao Patil", mobile: "9845012359", location: "Sarjapur", state: "Karnataka", notes: "", createdAt: Date.now() - 16 * 24 * 60 * 60 * 1000 },
  { id: "cust-16", name: "Gangadhar", mobile: "9845012360", location: "Tumkur", state: "Karnataka", notes: "", createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000 },
  { id: "cust-17", name: "Nagesh", mobile: "9845012361", location: "Chikballapur", state: "Karnataka", notes: "Deep tillage requirement", createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000 },
  { id: "cust-18", name: "Hanumanta", mobile: "9845012362", location: "Mandya", state: "Karnataka", notes: "", createdAt: Date.now() - 13 * 24 * 60 * 60 * 1000 },
  { id: "cust-19", name: "Ramappa", mobile: "9845012363", location: "Mysore", state: "Karnataka", notes: "Large holding farmer", createdAt: Date.now() - 12 * 24 * 60 * 60 * 1000 },
  { id: "cust-20", name: "Dyavappa", mobile: "9845012364", location: "Nelamangala", state: "Karnataka", notes: "", createdAt: Date.now() - 11 * 24 * 60 * 60 * 1000 }
];

// Helper to generate 50 mock bills
export const generateMockBills = (customers: Customer[]): Bill[] => {
  const bills: Bill[] = [];
  const hourlyRate = 1200;

  // Let's create bills spanning the last 30 days
  for (let i = 1; i <= 50; i++) {
    const customerIndex = (i * 7) % customers.length;
    const customer = customers[customerIndex];
    
    // Date spread over last 30 days
    const daysAgo = Math.floor((50 - i) * 0.58); // spreads 50 bills over ~29 days
    const dateObj = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const dateString = dateObj.toISOString().split("T")[0]; // YYYY-MM-DD
    
    const hoursUsed = Number((2 + (i % 4) * 1.25 + (i % 3) * 0.5).toFixed(2)); // e.g., 2.0, 3.75, 4.0, 5.25 etc.
    const usageCost = hoursUsed * hourlyRate;
    
    // Add charges based on index
    const extraCharges = [];
    if (i % 3 === 0) {
      extraCharges.push({ id: `chg-${i}-1`, name: "Diesel Charge", amount: 500 });
    }
    if (i % 5 === 0) {
      extraCharges.push({ id: `chg-${i}-2`, name: "Transportation", amount: 350 });
    }
    if (i % 7 === 0) {
      extraCharges.push({ id: `chg-${i}-3`, name: "Service Charge", amount: 150 });
    }
    
    const chargesTotal = extraCharges.reduce((acc, curr) => acc + curr.amount, 0);
    const discount = i % 4 === 0 ? 100 : i % 10 === 0 ? 300 : 0;
    const grandTotal = usageCost + chargesTotal - discount;
    
    // Status mix: recent ones pending, one rejected, rest approved
    let status: "APPROVED" | "PENDING_APPROVAL" | "REJECTED" | "IN_PROGRESS" = "APPROVED";
    if (i === 50) {
      status = "IN_PROGRESS";
    } else if (i === 49) {
      status = "PENDING_APPROVAL";
    } else if (i === 48) {
      status = "REJECTED";
    }

    const paymentStatus: "PAID" | "UNPAID" = status === "IN_PROGRESS" ? "UNPAID" : i % 2 === 0 ? "PAID" : "UNPAID";
    // Invoice numbers only for paid bills (paid-only sequence)
    const invoiceNumber =
      paymentStatus === "PAID" ? `INV-${String(i).padStart(5, "0")}` : undefined;

    const isOperatorBill = i % 2 === 0 || status === "IN_PROGRESS";
    bills.push({
      id: `bill-${i}`,
      invoiceNumber,
      ertNumber: `ERT-${String(i).padStart(4, "0")}`,
      customerId: customer.id,
      date: dateString,
      startTime: status === "IN_PROGRESS" ? "08:30" : "09:00",
      endTime: status === "IN_PROGRESS" ? undefined : "12:30",
      hoursUsed: status === "IN_PROGRESS" ? 0 : hoursUsed,
      hourlyRate,
      extraCharges: status === "IN_PROGRESS" ? [] : extraCharges,
      discount: status === "IN_PROGRESS" ? 0 : discount,
      grandTotal: status === "IN_PROGRESS" ? 0 : grandTotal,
      status,
      paymentStatus,
      paymentMode:
        paymentStatus === "PAID" ? (i % 4 === 0 ? "ONLINE" : "CASH") : undefined,
      createdBy: isOperatorBill ? "Operator" : "Admin Manager",
      createdByEmail: isOperatorBill ? "operator@demo.com" : "admin@demo.com",
      createdAt: dateObj.getTime()
    });
  }

  // Sort bills by date descending so recent ones are first
  return bills.sort((a, b) => b.createdAt - a.createdAt);
};
