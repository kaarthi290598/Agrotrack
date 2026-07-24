import React from "react";

type PdfPaymentBadgeProps = {
  status?: string;
};

/** Plain payment status text for PDF/print invoices */
export function PdfPaymentBadge({ status }: PdfPaymentBadgeProps) {
  const label =
    status === "PAID" ? "PAID" : status === "PARTIAL_PAID" ? "PARTIAL" : "UNPAID";

  return (
    <p
      style={{
        marginTop: 6,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "#047857",
      }}
    >
      Payment: {label}
    </p>
  );
}
