export async function downloadInvoicePdf(filename: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("PDF export is only available in the browser.");
  }

  const element = document.getElementById("print-area");
  if (!element) {
    throw new Error("Invoice content is not ready for export.");
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const previousClassName = element.className;
  const previousStyle = element.getAttribute("style");
  const previousParentOverflow = document.body.style.overflow;

  // Temporarily show the invoice for capture (it is normally `hidden`)
  element.className = previousClassName
    .replace(/\bhidden\b/g, "")
    .replace(/\bprint:[^\s]+/g, "")
    .trim();
  element.style.cssText = [
    "position: fixed",
    "left: 0",
    "top: 0",
    "width: 210mm",
    "min-height: 297mm",
    "padding: 32px",
    "margin: 0",
    "background: #ffffff",
    "color: #000000",
    "display: block",
    "visibility: visible",
    "opacity: 1",
    "z-index: 2147483646",
    "box-shadow: none",
    "border: none",
    "overflow: visible",
  ].join(";");
  document.body.style.overflow = "hidden";

  // Allow layout to settle and logo images to decode before capture
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      try {
        if (!img.complete) {
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        }
        if (typeof img.decode === "function") {
          await img.decode().catch(() => undefined);
        }
      } catch {
        // Ignore decode failures; capture will proceed without the image
      }
    })
  );

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", margin, position, usableWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeight - margin * 2;
    }

    const safeName =
      filename.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "invoice";
    pdf.save(`${safeName}.pdf`);
  } finally {
    element.className = previousClassName;
    if (previousStyle != null) {
      element.setAttribute("style", previousStyle);
    } else {
      element.removeAttribute("style");
    }
    document.body.style.overflow = previousParentOverflow;
  }
}
