const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseCatalogImportText,
} = require("../src/services/catalog-import-agent.service");

test("parseCatalogImportText previews ready catalog rows", () => {
  const result = parseCatalogImportText([
    "supplier,sku,name,basePrice,supplierPrice,stock",
    "Narayani Fresh Supply,TEA-MILK-500,Milk Tea Premix 500g,310,285,45",
  ].join("\n"));

  assert.deepEqual(result.summary, {
    totalRows: 1,
    readyRows: 1,
    reviewRows: 0,
  });
  assert.equal(result.rows[0].status, "ready");
  assert.equal(result.rows[0].data.supplierEmail, "narayani.fresh.supply@supplier.local");
  assert.equal(result.rows[0].data.basePrice, "310.00");
  assert.equal(result.rows[0].data.stock, 45);
});

test("parseCatalogImportText flags incomplete rows for review", () => {
  const result = parseCatalogImportText([
    "supplier,sku,name,basePrice,supplierPrice,stock",
    "Narayani Fresh Supply,,Milk Tea Premix 500g,310,abc,45",
  ].join("\n"));

  assert.equal(result.summary.totalRows, 1);
  assert.equal(result.summary.readyRows, 0);
  assert.equal(result.summary.reviewRows, 1);
  assert.equal(result.rows[0].status, "needs_review");
  assert.deepEqual(result.rows[0].errors, [
    "sku is required",
    "supplierPrice must be a valid amount",
  ]);
});
