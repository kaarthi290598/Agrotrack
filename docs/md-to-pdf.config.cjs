/** @type {import('md-to-pdf/dist/config').Config} */
module.exports = {
  stylesheet: ["docs/user-guide.css"],
  document_title: "Arkit Vedham India — User Guide",
  pdf_options: {
    format: "A4",
    margin: {
      top: "16mm",
      right: "14mm",
      bottom: "18mm",
      left: "14mm",
    },
    printBackground: true,
  },
};
