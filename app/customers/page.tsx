"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { customerService } from "../../services/customer.service";
import { billingService } from "../../services/billing.service";
import { Customer, Bill } from "../../types";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Textarea } from "../../components/ui/Textarea";
import { Dialog } from "../../components/ui/Dialog";
import { Card, CardContent } from "../../components/ui/Card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table";
import { Plus, Search, Edit2, Trash2, History, UserPlus, Phone, MapPin, Eye, Calendar, DollarSign, Clock, Users } from "lucide-react";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { useAuth } from "../../components/auth/AuthProvider";
import { isBillCreatedByUser } from "../../lib/utils";

// Validation schema for add/edit customer
const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  mobile: z.string()
    .min(10, "Mobile number must be at least 10 digits")
    .max(15, "Mobile number is too long")
    .regex(/^[0-9+\s-()]+$/, "Invalid phone number format"),
  location: z.string().optional(),
  state: z.string().optional(),
  notes: z.string().optional()
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const { orgId } = useClerkAuth();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  // Selected data state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerBills, setCustomerBills] = useState<Bill[]>([]);

  // React Hook Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema)
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await customerService.getAll(orgId || undefined);
      const bills = await billingService.getAll(orgId || undefined);
      setCustomers(data);
      setFilteredCustomers(data);
      setAllBills(bills);
    } catch (e) {
      toast({
        type: "error",
        title: "Error Loading Data",
        description: "Failed to fetch customers or billing history."
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  // Search logic
  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const result = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.mobile.includes(q) ||
        (c.location && c.location.toLowerCase().includes(q)) ||
        (c.state && c.state.toLowerCase().includes(q))
    );
    setFilteredCustomers(result);
  }, [searchQuery, customers]);

  // Create handler
  const onAddSubmit = async (values: CustomerFormValues) => {
    try {
      await customerService.create(values, orgId || undefined);
      toast({
        type: "success",
        title: "Customer Added",
        description: `${values.name} has been added successfully.`
      });
      setIsAddOpen(false);
      reset();
      loadData();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Add Failed",
        description: error.message || "Could not add customer."
      });
    }
  };

  // Edit click
  const handleEditClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    reset({
      name: customer.name,
      mobile: customer.mobile,
      location: customer.location || "",
      state: customer.state || "",
      notes: customer.notes || ""
    });
    setIsEditOpen(true);
  };

  // Edit handler
  const onEditSubmit = async (values: CustomerFormValues) => {
    if (!selectedCustomer) return;
    try {
      await customerService.update(selectedCustomer.id, values);
      toast({
        type: "success",
        title: "Customer Updated",
        description: `${values.name} profile has been updated.`
      });
      setIsEditOpen(false);
      reset();
      setSelectedCustomer(null);
      loadData();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Update Failed",
        description: error.message || "Could not update customer."
      });
    }
  };

  // Delete click
  const handleDeleteClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDeleteOpen(true);
  };

  // Delete handler
  const handleDeleteConfirm = async () => {
    if (!selectedCustomer) return;
    try {
      await customerService.delete(selectedCustomer.id);
      toast({
        type: "success",
        title: "Customer Deleted",
        description: `${selectedCustomer.name} has been deleted.`
      });
      setIsDeleteOpen(false);
      setSelectedCustomer(null);
      loadData();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Delete Failed",
        description: error.message || "Failed to remove customer."
      });
    }
  };

  // History click
  const handleHistoryClick = (customer: Customer) => {
    setSelectedCustomer(customer);
    const filtered = allBills.filter((b) => b.customerId === customer.id && isBillCreatedByUser(b, user, isAdmin));
    setCustomerBills(filtered);
    setIsHistoryOpen(true);
  };

  // Summary figures for history view
  const lifetimeSpend = customerBills.reduce((sum, b) => sum + b.grandTotal, 0);
  const totalHours = customerBills.reduce((sum, b) => sum + b.hoursUsed, 0);
  const avgHours = customerBills.length > 0 ? Number((totalHours / customerBills.length).toFixed(2)) : 0;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Customer Database</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            View profiles, billing histories, contact information, and villages.
          </p>
        </div>
        <Button
          onClick={() => {
            reset({ name: "", mobile: "", location: "", state: "", notes: "" });
            setIsAddOpen(true);
          }}
          className="sm:w-auto cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" />
          Add Customer
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="relative w-full">
            <Search className="absolute top-3 left-3 h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search by name, mobile, location, or state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 transition-all"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Customers List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <div className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800 w-full"></div>
              <div className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800 w-full"></div>
              <div className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800 w-full"></div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-900">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">No customers found</h3>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {searchQuery ? "Try refining your search keyword." : "Add your first customer to get started."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile Number</TableHead>
                  <TableHead>Location & State</TableHead>
                  <TableHead className="hidden md:table-cell">Registered Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((cust) => (
                  <TableRow key={cust.id}>
                    <TableCell className="font-medium text-slate-900 dark:text-white">
                      {cust.name}
                    </TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                      {cust.mobile}
                    </TableCell>
                    <TableCell>
                      {cust.location || cust.state ? (
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                          <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                          {cust.location || ''}{cust.location && cust.state ? ', ' : ''}{cust.state || ''}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Not specified</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-slate-500 text-xs">
                      {new Date(cust.createdAt).toLocaleDateString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleHistoryClick(cust)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Billing History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditClick(cust)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Edit Customer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(cust)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Delete Customer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add New Customer"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="cursor-pointer">Cancel</Button>
            <Button variant="primary" onClick={handleSubmit(onAddSubmit)} className="cursor-pointer">Add Customer</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onAddSubmit)} className="space-y-4">
          <Input
            label="Customer Name *"
            placeholder="Enter farmer's full name"
            error={errors.name?.message}
            {...register("name")}
          />
          <Input
            label="Mobile Number *"
            type="tel"
            placeholder="Enter 10 digit mobile"
            error={errors.mobile?.message}
            {...register("mobile")}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Location (Town/Village)"
              placeholder="e.g. Hebbal"
              error={errors.location?.message}
              {...register("location")}
            />
            <Input
              label="State Name"
              placeholder="e.g. Karnataka"
              error={errors.state?.message}
              {...register("state")}
            />
          </div>
          <Textarea
            label="Notes (Optional)"
            placeholder="Add farmer preferences, land information etc."
            error={errors.notes?.message}
            {...register("notes")}
          />
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Customer Profile"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="cursor-pointer">Cancel</Button>
            <Button variant="primary" onClick={handleSubmit(onEditSubmit)} className="cursor-pointer">Save Changes</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onEditSubmit)} className="space-y-4">
          <Input
            label="Customer Name *"
            placeholder="Enter farmer's full name"
            error={errors.name?.message}
            {...register("name")}
          />
          <Input
            label="Mobile Number *"
            type="tel"
            placeholder="Enter 10 digit mobile"
            error={errors.mobile?.message}
            {...register("mobile")}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Location (Town/Village)"
              placeholder="e.g. Hebbal"
              error={errors.location?.message}
              {...register("location")}
            />
            <Input
              label="State Name"
              placeholder="e.g. Karnataka"
              error={errors.state?.message}
              {...register("state")}
            />
          </div>
          <Textarea
            label="Notes"
            placeholder="Add farmer preferences, land details etc."
            error={errors.notes?.message}
            {...register("notes")}
          />
        </form>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Confirm Deletion"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="cursor-pointer">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} className="cursor-pointer">Delete Customer</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-white">{selectedCustomer?.name}</span>?
          </p>
          <div className="rounded-lg bg-red-50 p-3.5 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30 text-xs text-red-800 dark:text-red-300">
            <strong>Warning:</strong> This will delete this profile. Bills generated under this customer will remain in billing records but will point to a deleted entity.
          </div>
        </div>
      </Dialog>

      {/* History Dialog */}
      <Dialog
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title={`${selectedCustomer?.name || "Customer"}'s Billing History`}
        className="max-w-2xl"
        footer={
          <Button variant="outline" onClick={() => setIsHistoryOpen(false)} className="cursor-pointer">Close History</Button>
        }
      >
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold leading-none">Total Spent</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mt-1">₹{lifetimeSpend}</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold leading-none">Total Hours</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mt-1">{totalHours} hr</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800 flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold leading-none">Bills Count</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none mt-1">{customerBills.length}</p>
              </div>
            </div>
          </div>

          {/* Details list */}
          <div>
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Invoice Logs</h4>
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg dark:border-slate-800">
              {customerBills.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No bills generated for this customer yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2.5">Invoice No</TableHead>
                      <TableHead className="py-2.5">Date</TableHead>
                      <TableHead className="py-2.5">Hours</TableHead>
                      <TableHead className="py-2.5 text-right">Grand Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerBills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-semibold text-xs py-2.5">{bill.invoiceNumber}</TableCell>
                        <TableCell className="text-xs text-slate-500 py-2.5">{bill.date}</TableCell>
                        <TableCell className="text-xs py-2.5">{bill.hoursUsed} hr</TableCell>
                        <TableCell className="text-xs font-bold text-right py-2.5">₹{bill.grandTotal}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
          
          {/* Notes summary */}
          {selectedCustomer?.notes && (
            <div className="rounded-xl border border-slate-200 bg-emerald-50/20 p-4 dark:border-slate-800 dark:bg-emerald-950/10">
              <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">Customer Log Note:</span>
              <p className="text-xs text-slate-600 dark:text-slate-350 mt-1 italic">"{selectedCustomer.notes}"</p>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
