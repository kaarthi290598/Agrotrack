"use client";

import React from "react";
import { Bill, Settings } from "../../types";
import { PdfPaymentBadge } from "./PdfPaymentBadge";
import { amountInWords } from "../../lib/amount-in-words";
import {
  computeInvoiceTax,
  formatInvoiceDate,
  formatInvoiceMoney,
} from "../../lib/invoice-tax";

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

function customerAddress(bill: InvoiceBillView): string {
  return [bill.customerLocation, bill.customerState].filter(Boolean).join(", ");
}

function InvoiceBody({
  bill,
  settings,
  currencySymbol,
  compact = false,
}: InvoiceDocumentProps & { compact?: boolean }) {
  const tax = computeInvoiceTax(bill.grandTotal, settings.defaultTax);
  const hsn = settings.hsnCode?.trim() || "-";
  const taxLabel =
    tax.taxRate > 0 ? `${tax.taxRate % 1 === 0 ? tax.taxRate : tax.taxRate.toFixed(2)}%` : "-";
  const money = (n: number) => formatInvoiceMoney(n, currencySymbol);
  const usageAmount = bill.hoursUsed * bill.hourlyRate;
  const lineNoStart = 1;

  return (
    <div className={compact ? "space-y-4 text-[11px]" : "space-y-5 text-xs"}>
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-3 min-w-0">
          {settings.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.logoUrl}
              alt=""
              crossOrigin="anonymous"
              className={
                compact
                  ? "h-20 w-20 object-contain shrink-0"
                  : "h-28 w-28 object-contain shrink-0"
              }
            />
          )}
          <div className="min-w-0">
            <h1
              className={`font-bold text-slate-900 uppercase tracking-tight leading-tight ${
                compact ? "text-sm" : "text-lg"
              }`}
            >
              {settings.businessName}
            </h1>
            {settings.businessAddress && (
              <p className="text-[10px] text-slate-600 mt-1 whitespace-pre-line max-w-xs leading-snug">
                {settings.businessAddress}
              </p>
            )}
            {settings.phoneNumber && (
              <p className="text-[10px] text-slate-600 mt-0.5">
                Phone: {settings.phoneNumber}
              </p>
            )}
            {settings.gstNumber && (
              <p className="text-[10px] text-slate-800 font-semibold mt-0.5">
                GSTIN: {settings.gstNumber}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right w-44">
          <h2
            className={`font-bold text-emerald-700 uppercase tracking-wide ${
              compact ? "text-sm" : "text-base"
            }`}
          >
            Tax Invoice
          </h2>
          <div className="mt-2 border border-slate-300 text-[10px]">
            <div className="flex justify-between gap-2 border-b border-slate-200 px-2 py-1.5">
              <span className="font-bold text-slate-700">Invoice No</span>
              <span className="font-semibold text-slate-900">
                {bill.invoiceNumber || "Pending"}
              </span>
            </div>
            <div className="flex justify-between gap-2 px-2 py-1.5">
              <span className="font-bold text-slate-700">Date</span>
              <span className="text-slate-900">{formatInvoiceDate(bill.date)}</span>
            </div>
          </div>
          <div className="mt-2 flex justify-end">
            <PdfPaymentBadge status={bill.paymentStatus} />
          </div>
        </div>
      </div>

      {/* Billed To */}
      <div className="border border-slate-300 bg-slate-50 px-3 py-2.5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          Billed To:
        </h3>
        <p className="font-bold text-slate-900 text-sm mt-1">{bill.customerName}</p>
        {customerAddress(bill) && (
          <p className="text-[10px] text-slate-600 mt-0.5">{customerAddress(bill)}</p>
        )}
        {bill.customerMobile && (
          <p className="text-[10px] text-slate-600 mt-0.5">
            Mobile: {bill.customerMobile}
          </p>
        )}
      </div>

      {/* Line items */}
      <table className="w-full border-collapse border border-slate-300 text-[10px]">
        <thead>
          <tr className="bg-emerald-700 text-white">
            <th className="border border-emerald-800 px-1.5 py-2 text-left font-bold w-8">
              S.No
            </th>
            <th className="border border-emerald-800 px-1.5 py-2 text-left font-bold">
              Description
            </th>
            <th className="border border-emerald-800 px-1.5 py-2 text-center font-bold w-16">
              HSN/SAC
            </th>
            <th className="border border-emerald-800 px-1.5 py-2 text-center font-bold w-14">
              Qty
            </th>
            <th className="border border-emerald-800 px-1.5 py-2 text-right font-bold w-20">
              Rate
            </th>
            <th className="border border-emerald-800 px-1.5 py-2 text-center font-bold w-12">
              Tax%
            </th>
            <th className="border border-emerald-800 px-1.5 py-2 text-right font-bold w-22">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="border border-slate-200 px-1.5 py-2 text-center text-slate-700">
              {lineNoStart}
            </td>
            <td className="border border-slate-200 px-1.5 py-2">
              <p className="font-semibold text-slate-900">Machine Rental Usage</p>
              <p className="text-[9px] text-slate-500">
                Harvesting services on hourly charges
              </p>
            </td>
            <td className="border border-slate-200 px-1.5 py-2 text-center text-slate-700">
              {hsn}
            </td>
            <td className="border border-slate-200 px-1.5 py-2 text-center text-slate-700">
              {bill.hoursUsed} Hrs
            </td>
            <td className="border border-slate-200 px-1.5 py-2 text-right text-slate-800">
              {money(bill.hourlyRate)}
            </td>
            <td className="border border-slate-200 px-1.5 py-2 text-center text-slate-700">
              {taxLabel}
            </td>
            <td className="border border-slate-200 px-1.5 py-2 text-right font-semibold text-slate-900">
              {money(usageAmount)}
            </td>
          </tr>
          {bill.extraCharges.map((chg, index) => (
            <tr key={chg.id} className="border-b border-slate-200">
              <td className="border border-slate-200 px-1.5 py-2 text-center text-slate-700">
                {lineNoStart + 1 + index}
              </td>
              <td className="border border-slate-200 px-1.5 py-2">
                <p className="font-semibold text-slate-900">{chg.name}</p>
                <p className="text-[9px] text-slate-500">Additional charge</p>
              </td>
              <td className="border border-slate-200 px-1.5 py-2 text-center text-slate-700">
                {hsn}
              </td>
              <td className="border border-slate-200 px-1.5 py-2 text-center text-slate-700">
                1
              </td>
              <td className="border border-slate-200 px-1.5 py-2 text-right text-slate-800">
                {money(chg.amount)}
              </td>
              <td className="border border-slate-200 px-1.5 py-2 text-center text-slate-700">
                {taxLabel}
              </td>
              <td className="border border-slate-200 px-1.5 py-2 text-right font-semibold text-slate-900">
                {money(chg.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-1 text-[10px]">
          {bill.discount > 0 && (
            <div className="flex justify-between text-red-600">
              <span className="font-semibold">Discount</span>
              <span>-{money(bill.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-700">
            <span>Subtotal</span>
            <span>{money(tax.subtotal)}</span>
          </div>
          {tax.taxRate > 0 && (
            <>
              <div className="flex justify-between text-slate-700">
                <span>
                  CGST (
                  {tax.taxRate / 2 === Math.floor(tax.taxRate / 2)
                    ? tax.taxRate / 2
                    : (tax.taxRate / 2).toFixed(2)}
                  %)
                </span>
                <span>{money(tax.cgst)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>
                  SGST (
                  {tax.taxRate / 2 === Math.floor(tax.taxRate / 2)
                    ? tax.taxRate / 2
                    : (tax.taxRate / 2).toFixed(2)}
                  %)
                </span>
                <span>{money(tax.sgst)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Total Tax</span>
                <span>{money(tax.tax)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center bg-slate-100 border border-slate-300 px-2 py-2 font-bold text-sm text-emerald-700 mt-1">
            <span>Grand Total</span>
            <span>{money(tax.invoiceTotal)}</span>
          </div>
        </div>
      </div>

      {/* Amount in words */}
      <div className="border border-slate-300 bg-slate-50 px-3 py-2 text-[10px] italic text-slate-700">
        {amountInWords(tax.invoiceTotal)}
      </div>

      {/* Footer */}
      <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 items-end">
        <div className="text-[9px] text-slate-500">
          {(settings.invoiceNotes || settings.footerText) && (
            <>
              <span className="font-bold uppercase tracking-wider block text-slate-600 mb-1">
                Notes
              </span>
              {settings.invoiceNotes && <p>{settings.invoiceNotes}</p>}
              {settings.footerText && <p className="mt-2">{settings.footerText}</p>}
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-800">
            For {settings.businessName}
          </p>
          <div className="h-10" />
          <p className="text-[9px] text-slate-400">Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
}

export function InvoicePrintArea({
  bill,
  settings,
  currencySymbol,
}: InvoiceDocumentProps) {
  return (
    <div
      id="print-area"
      className="hidden print:block print:p-8 bg-white text-black font-sans text-xs w-[210mm] min-h-[297mm]"
    >
      <InvoiceBody
        bill={bill}
        settings={settings}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}

export function InvoicePreviewContent({
  bill,
  settings,
  currencySymbol,
}: InvoiceDocumentProps) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-white text-slate-900 shadow-inner max-h-[55vh] overflow-y-auto">
      <InvoiceBody
        bill={bill}
        settings={settings}
        currencySymbol={currencySymbol}
        compact
      />
    </div>
  );
}

export const invoiceViewButtonClass =
  "rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 transition-colors cursor-pointer";
