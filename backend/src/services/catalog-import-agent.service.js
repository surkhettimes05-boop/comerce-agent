const REQUIRED_FIELDS = [
  "supplier",
  "sku",
  "name",
  "basePrice",
  "supplierPrice",
  "stock",
];

const HEADER_ALIASES = new Map([
  ["supplier", "supplier"],
  ["suppliername", "supplier"],
  ["supplier_name", "supplier"],
  ["vendor", "supplier"],
  ["sku", "sku"],
  ["productsku", "sku"],
  ["product_sku", "sku"],
  ["name", "name"],
  ["product", "name"],
  ["productname", "name"],
  ["product_name", "name"],
  ["baseprice", "basePrice"],
  ["base_price", "basePrice"],
  ["price", "basePrice"],
  ["mrp", "basePrice"],
  ["supplierprice", "supplierPrice"],
  ["supplier_price", "supplierPrice"],
  ["rate", "supplierPrice"],
  ["cost", "supplierPrice"],
  ["stock", "stock"],
  ["available", "stock"],
  ["available_stock", "stock"],
  ["qty", "stock"],
  ["suppliersku", "supplierSku"],
  ["supplier_sku", "supplierSku"],
  ["description", "description"],
  ["desc", "description"],
  ["phone", "phone"],
  ["supplierphone", "phone"],
  ["supplier_phone", "phone"],
  ["email", "email"],
  ["supplieremail", "email"],
  ["supplier_email", "email"],
]);

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "");
}

function parseDelimitedLine(line) {
  const cells = [];
  let currentCell = "";
  let insideQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && insideQuote && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuote = !insideQuote;
      continue;
    }

    if (character === "," && !insideQuote) {
      cells.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  cells.push(currentCell.trim());

  return cells;
}

function normalizeMoney(value) {
  const cleaned = String(value || "").replace(/npr|rs\.?|,/gi, "").trim();
  const numericValue = Number.parseFloat(cleaned);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue.toFixed(2);
}

function normalizeStock(value) {
  const numericValue = Number.parseInt(String(value || "").replace(/,/g, ""), 10);

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    return null;
  }

  return numericValue;
}

function supplierEmailFromName(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  return `${slug || "supplier"}@supplier.local`;
}

function normalizeRow(rawRow, rowNumber) {
  const errors = [];
  const supplier = String(rawRow.supplier || "").trim();
  const sku = String(rawRow.sku || "").trim().toUpperCase();
  const name = String(rawRow.name || "").trim();
  const basePrice = normalizeMoney(rawRow.basePrice);
  const supplierPrice = normalizeMoney(rawRow.supplierPrice);
  const stock = normalizeStock(rawRow.stock);

  if (!supplier) {
    errors.push("supplier is required");
  }

  if (!sku) {
    errors.push("sku is required");
  }

  if (!name) {
    errors.push("name is required");
  }

  if (!basePrice) {
    errors.push("basePrice must be a valid amount");
  }

  if (!supplierPrice) {
    errors.push("supplierPrice must be a valid amount");
  }

  if (stock === null) {
    errors.push("stock must be a non-negative integer");
  }

  return {
    rowNumber,
    status: errors.length === 0 ? "ready" : "needs_review",
    errors,
    data: {
      supplier,
      supplierEmail: String(rawRow.email || "").trim().toLowerCase() || supplierEmailFromName(supplier),
      supplierPhone: String(rawRow.phone || "").trim() || null,
      sku,
      name,
      description: String(rawRow.description || "").trim() || null,
      basePrice,
      supplierSku: String(rawRow.supplierSku || "").trim() || null,
      supplierPrice,
      stock,
    },
  };
}

function parseCatalogImportText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      rows: [],
      summary: {
        totalRows: 0,
        readyRows: 0,
        reviewRows: 0,
      },
      errors: ["Paste a header row and at least one data row."],
    };
  }

  const headers = parseDelimitedLine(lines[0]).map((header) => {
    const normalizedHeader = normalizeHeader(header);
    return HEADER_ALIASES.get(normalizedHeader) || normalizedHeader;
  });
  const missingFields = REQUIRED_FIELDS.filter((field) => !headers.includes(field));

  if (missingFields.length > 0) {
    return {
      rows: [],
      summary: {
        totalRows: 0,
        readyRows: 0,
        reviewRows: 0,
      },
      errors: [`Missing required columns: ${missingFields.join(", ")}.`],
    };
  }

  const rows = lines.slice(1).map((line, index) => {
    const cells = parseDelimitedLine(line);
    const rawRow = {};

    headers.forEach((header, headerIndex) => {
      rawRow[header] = cells[headerIndex] || "";
    });

    return normalizeRow(rawRow, index + 2);
  });

  const readyRows = rows.filter((row) => row.status === "ready").length;

  return {
    rows,
    summary: {
      totalRows: rows.length,
      readyRows,
      reviewRows: rows.length - readyRows,
    },
    errors: [],
  };
}

async function importCatalogRows(options = {}) {
  const { rows, tenantId, prismaClient, upsertProduct, upsertSupplier, upsertSupplierRate } = options;

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("rows are required.");
  }

  const readyRows = rows.filter((row) => row?.status === "ready" && row.data);

  if (readyRows.length === 0) {
    throw new Error("No ready rows to import.");
  }

  const imported = [];

  for (const row of readyRows) {
    const supplier = await upsertSupplier({
      tenantId,
      prismaClient,
      name: row.data.supplier,
      email: row.data.supplierEmail,
      phone: row.data.supplierPhone,
    });
    const product = await upsertProduct({
      tenantId,
      prismaClient,
      sku: row.data.sku,
      name: row.data.name,
      description: row.data.description,
      price: row.data.basePrice,
    });
    const rate = await upsertSupplierRate({
      tenantId,
      prismaClient,
      supplierId: supplier.id,
      productId: product.id,
      supplierSku: row.data.supplierSku,
      supplierPrice: row.data.supplierPrice,
      availableStock: row.data.stock,
    });

    imported.push({
      rowNumber: row.rowNumber,
      supplier,
      product,
      rate,
    });
  }

  return {
    importedRows: imported.length,
    skippedRows: rows.length - imported.length,
    rows: imported,
  };
}

module.exports = {
  importCatalogRows,
  parseCatalogImportText,
};
