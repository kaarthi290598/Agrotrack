"use client";

import React from "react";
import { Bill, Settings } from "../../types";
import { PdfPaymentBadge } from "./PdfPaymentBadge";

export type InvoiceBillView = Bill & {
  customerName?: string;
  customerMobile?: string;
  customerLocation?: string;
  customerState?: string;
};

type InvoiceDocumentProps = {
  bill: InvoiceBillView;
  settings: Settings;
  currencySymbol: string;
};

export function InvoicePrintArea({ bill, settings, currencySymbol }: InvoiceDocumentProps) {
  return (
    <div id="print-area" className="hidden print:block print:p-8 bg-white text-black font-sans text-xs w-[210mm] min-h-[297mm]">
      <div className="border-b-2 border-slate-350 pb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight uppercase leading-none">{settings.businessName}</h1>
          <p className="text-[10px] text-slate-500 mt-1 max-w-xs">{settings.businessAddress}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Phone: {settings.phoneNumber}</p>
          {settings.gstNumber && (
            <p className="text-[10px] text-slate-700 font-semibold mt-0.5">GSTIN: {settings.gstNumber}</p>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-sm font-bold text-emerald-700 tracking-wide uppercase">Tax Invoice</h2>
          <p className="font-semibold text-slate-900 mt-1.5">{bill.invoiceNumber}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Date: {bill.date}</p>
          <PdfPaymentBadge status={bill.paymentStatus} />
        </div>
      </div>

      <div className="my-6 grid grid-cols-2 gap-8 bg-slate-50 p-4 rounded-lg border border-slate-100">
        <div>
          <h3 className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Bill To:</h3>
          <p className="font-bold text-slate-800 text-sm mt-1">{bill.customerName}</p>
          <p className="text-slate-600 mt-0.5">Mobile: {bill.customerMobile}</p>
          {(bill.customerLocation || bill.customerState) && (
            <p className="text-slate-600 mt-0.5">
              Location: {bill.customerLocation || ""}
              {bill.customerLocation && bill.customerState ? ", " : ""}
              {bill.customerState || ""}
            </p>
          )}
        </div>
        <div className="text-right flex flex-col justify-end">
          <p className="text-[10px] text-slate-600">
            Hours Rent Rate: {currencySymbol}
            {bill.hourlyRate} / hour
          </p>
          <p className="text-[10px] text-slate-600">Usage Duration: {bill.hoursUsed} hr</p>
        </div>
      </div>

      <table className="w-full text-left border-collapse border border-slate-200 mt-6">
        <thead>
          <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
            <th className="p-2">Description</th>
            <th className="p-2 text-center">Unit / Rate</th>
            <th className="p-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-150">
            <td className="p-2">
              <p className="font-semibold">Machine Rental Usage</p>
              <span className="text-[10px] text-slate-450">Tillage / Harvesting services on hourly charges</span>
            </td>
            <td className="p-2 text-center">
              {bill.hoursUsed} hr × {currencySymbol}
              {bill.hourlyRate}
            </td>
            <td className="p-2 text-right font-semibold">
              {currencySymbol}
              {bill.hoursUsed * bill.hourlyRate}
            </td>
          </tr>
          {bill.extraCharges.map((chg) => (
            <tr key={chg.id} className="border-b border-slate-150">
              <td className="p-2">
                <p className="font-semibold">{chg.name}</p>
                <span className="text-[10px] text-slate-450">Additional service/operating fees</span>
              </td>
              <td className="p-2 text-center">Lump sum</td>
              <td className="p-2 text-right font-semibold">
                {currencySymbol}
                {chg.amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 flex justify-end">
        <div className="w-64 space-y-1.5 text-right border-t border-slate-200 pt-4">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Subtotal Usage:</span>
            <span>
              {currencySymbol}
              {bill.hoursUsed * bill.hourlyRate}
            </span>
          </div>
          {bill.extraCharges.length > 0 && (
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-500">Additional Charges:</span>
              <span>
                +{currencySymbol}
                {bill.extraCharges.reduce((s, c) => s + c.amount, 0)}
              </span>
            </div>
          )}
          {bill.discount > 0 && (
            <div className="flex justify-between text-[10px] text-red-600 font-semibold">
              <span>Discount Applied:</span>
              <span>
                -{currencySymbol}
                {bill.discount}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t-2 border-emerald-600 pt-2 font-bold text-sm text-slate-800">
            <span>Grand Total:</span>
            <span className="text-emerald-700">
              {currencySymbol}
              {bill.grandTotal}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-2 gap-8 items-end border-t border-slate-100 pt-8">
        <div className="text-[9px] text-slate-500">
          <span className="font-bold uppercase tracking-wider block text-slate-600 mb-1">Invoice Notes</span>
          <p>{settings.invoiceNotes || "Please clear payment within due period."}</p>
          {settings.footerText && <p className="mt-4">{settings.footerText}</p>}
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="h-10 w-24 border-b border-slate-300" />
          <p className="text-[10px] font-semibold text-slate-700 mt-2">Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
}

export function InvoicePreviewContent({ bill, settings, currencySymbol }: InvoiceDocumentProps) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-[11px] space-y-4 shadow-inner max-h-[50vh] overflow-y-auto">
      <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div>
          <h3 className="font-bold text-xs text-emerald-600">{settings.businessName}</h3>
          <p className="text-[10px] text-slate-500">{settings.businessAddress}</p>
          <p className="text-[10px] text-slate-500">Phone: {settings.phoneNumber}</p>
        </div>
        <div className="text-right">
          <h4 className="font-bold text-xs uppercase text-slate-400">Tax Invoice</h4>
          <p className="font-bold">{bill.invoiceNumber}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Date: {bill.date}</p>
          <PdfPaymentBadge status={bill.paymentStatus} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-[10px]">
        <div>
          <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Farmer Info</span>
          <p className="font-bold">{bill.customerName}</p>
          <p>Mobile: {bill.customerMobile}</p>
          {(bill.customerLocation || bill.customerState) && (
            <p>
              Location: {bill.customerLocation || ""}
              {bill.customerLocation && bill.customerState ? ", " : ""}
              {bill.customerState || ""}
            </p>
          )}
        </div>
        <div className="text-right flex flex-col justify-end">
          <p>
            Rent Rate: {currencySymbol}
            {bill.hourlyRate}/hour
          </p>
          <p>Duration: {bill.hoursUsed} hours</p>
          <p>Date: {bill.date}</p>
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1 text-[9px] uppercase">
              <th>Description</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-50 dark:border-slate-900">
              <td className="py-2">Machine Rental Usage ({bill.hoursUsed} hr)</td>
              <td className="text-right py-2">
                {currencySymbol}
                {bill.hoursUsed * bill.hourlyRate}
              </td>
            </tr>
            {bill.extraCharges.map((chg) => (
              <tr key={chg.id} className="border-b border-slate-50 dark:border-slate-900">
                <td className="py-2">{chg.name}</td>
                <td className="text-right py-2">
                  +{currencySymbol}
                  {chg.amount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-end pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
        <div className="flex justify-between w-48 text-[10px]">
          <span className="text-slate-400">Subtotal:</span>
          <span>
            {currencySymbol}
            {bill.hoursUsed * bill.hourlyRate + bill.extraCharges.reduce((s, c) => s + c.amount, 0)}
          </span>
        </div>
        {bill.discount > 0 && (
          <div className="flex justify-between w-48 text-[10px] text-red-500">
            <span className="font-semibold">Discount:</span>
            <span>
              -{currencySymbol}
              {bill.discount}
            </span>
          </div>
        )}
        <div className="flex justify-between w-48 font-bold text-xs pt-1.5 border-t border-slate-100 dark:border-slate-800">
          <span>Grand Total:</span>
          <span className="text-emerald-600">
            {currencySymbol}
            {bill.grandTotal}
          </span>
        </div>
      </div>
    </div>
  );
}

export const invoiceViewButtonClass =
  "rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 transition-colors cursor-pointer";
