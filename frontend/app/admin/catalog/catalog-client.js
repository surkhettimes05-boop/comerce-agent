"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const emptyProduct = {
  sku: "",
  name: "",
  description: "",
  price: "",
};

const emptySupplier = {
  name: "",
  email: "",
  phone: "",
};

const emptyRate = {
  productId: "",
  supplierId: "",
  supplierSku: "",
  supplierPrice: "",
  availableStock: "",
};

function Field({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: "#516055" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle() {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #cbbca9",
    borderRadius: 8,
    padding: "11px 12px",
    background: "#fffdf8",
    color: "#1f2e26",
    fontSize: 14,
  };
}

function FormPanel({ title, children, onSubmit, isSaving }) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "grid",
        gap: 12,
        alignContent: "start",
        border: "1px solid #e1d7c8",
        borderRadius: 8,
        padding: 16,
        background: "#fffdf8",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
      {children}
      <button
        type="submit"
        disabled={isSaving}
        style={{
          border: 0,
          borderRadius: 8,
          padding: "12px 14px",
          background: isSaving ? "#8f8a82" : "#1f4f39",
          color: "#fffaf0",
          fontWeight: 900,
          cursor: isSaving ? "wait" : "pointer",
        }}
      >
        {isSaving ? "Saving" : "Save"}
      </button>
    </form>
  );
}

async function readJson(response) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

export default function CatalogAdminClient({ initialCatalog }) {
  const [catalog, setCatalog] = useState({
    products: initialCatalog?.products || [],
    suppliers: initialCatalog?.suppliers || [],
  });
  const [product, setProduct] = useState(emptyProduct);
  const [supplier, setSupplier] = useState(emptySupplier);
  const [rate, setRate] = useState(emptyRate);
  const [status, setStatus] = useState("");
  const [error, setError] = useState(initialCatalog?.loadError || "");
  const [isSaving, setIsSaving] = useState(false);

  const canSaveRate = useMemo(
    () => catalog.products.length > 0 && catalog.suppliers.length > 0,
    [catalog],
  );

  async function loadCatalog() {
    const response = await fetch("/api/admin/catalog", { cache: "no-store" });
    const payload = await readJson(response);
    setCatalog(payload);
    setRate((current) => ({
      ...current,
      productId: current.productId || payload.products[0]?.id || "",
      supplierId: current.supplierId || payload.suppliers[0]?.id || "",
    }));
  }

  useEffect(() => {
    setRate((current) => ({
      ...current,
      productId: current.productId || catalog.products[0]?.id || "",
      supplierId: current.supplierId || catalog.suppliers[0]?.id || "",
    }));
  }, [catalog.products, catalog.suppliers]);

  async function submitJson(path, body) {
    setIsSaving(true);
    setStatus("");
    setError("");

    try {
      await readJson(
        await fetch(path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }),
      );
      await loadCatalog();
      setStatus("Saved. Customer chat will use the latest catalog data.");
    } catch (submitError) {
      setError(submitError.message || "Unable to save.");
    } finally {
      setIsSaving(false);
    }
  }

  function submitProduct(event) {
    event.preventDefault();
    submitJson("/api/admin/products", product).then(() => {
      setProduct(emptyProduct);
    });
  }

  function submitSupplier(event) {
    event.preventDefault();
    submitJson("/api/admin/suppliers", supplier).then(() => {
      setSupplier(emptySupplier);
    });
  }

  function submitRate(event) {
    event.preventDefault();
    submitJson("/api/admin/supplier-rates", rate).then(() => {
      setRate((current) => ({
        ...emptyRate,
        productId: current.productId,
        supplierId: current.supplierId,
      }));
    });
  }

  return (
    <main style={{ minHeight: "100vh", padding: "24px 16px 48px" }}>
      <section style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gap: 20 }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 16,
            flexWrap: "wrap",
            borderBottom: "1px solid #ded4c6",
            paddingBottom: 18,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                color: "#667468",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Khaacho Admin
            </p>
            <h1 style={{ margin: "6px 0 0", fontSize: 34 }}>
              Catalog & Supplier Rates
            </h1>
          </div>
          <nav style={{ display: "flex", gap: 10 }}>
            <Link href="/admin" style={{ color: "#1f4f39", fontWeight: 800 }}>
              Dashboard
            </Link>
            <Link href="/admin/import" style={{ color: "#1f4f39", fontWeight: 800 }}>
              Import data
            </Link>
            <Link href="/admin/growth" style={{ color: "#1f4f39", fontWeight: 800 }}>
              Growth
            </Link>
            <Link href="/chat" style={{ color: "#8a451e", fontWeight: 800 }}>
              Customer chat
            </Link>
          </nav>
        </header>

        {status ? (
          <div
            style={{
              borderRadius: 8,
              padding: 12,
              background: "#e8f3e8",
              color: "#1f4f39",
              fontWeight: 800,
            }}
          >
            {status}
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              borderRadius: 8,
              padding: 12,
              background: "#fff1ec",
              color: "#8c2f15",
              fontWeight: 800,
            }}
          >
            {error}
          </div>
        ) : null}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          <FormPanel title="Product" onSubmit={submitProduct} isSaving={isSaving}>
            <Field label="SKU">
              <input
                value={product.sku}
                onChange={(event) => setProduct({ ...product, sku: event.target.value })}
                placeholder="TEA-MILK-500"
                required
                style={inputStyle()}
              />
            </Field>
            <Field label="Name">
              <input
                value={product.name}
                onChange={(event) => setProduct({ ...product, name: event.target.value })}
                placeholder="Milk Tea Premix 500g"
                required
                style={inputStyle()}
              />
            </Field>
            <Field label="Base price NPR">
              <input
                value={product.price}
                onChange={(event) => setProduct({ ...product, price: event.target.value })}
                placeholder="310.00"
                required
                inputMode="decimal"
                style={inputStyle()}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={product.description}
                onChange={(event) =>
                  setProduct({ ...product, description: event.target.value })
                }
                rows={3}
                style={inputStyle()}
              />
            </Field>
          </FormPanel>

          <FormPanel title="Supplier" onSubmit={submitSupplier} isSaving={isSaving}>
            <Field label="Name">
              <input
                value={supplier.name}
                onChange={(event) => setSupplier({ ...supplier, name: event.target.value })}
                placeholder="Narayani Fresh Supply"
                required
                style={inputStyle()}
              />
            </Field>
            <Field label="Email">
              <input
                value={supplier.email}
                onChange={(event) => setSupplier({ ...supplier, email: event.target.value })}
                placeholder="supplier.narayani@example.com"
                required
                type="email"
                style={inputStyle()}
              />
            </Field>
            <Field label="Phone">
              <input
                value={supplier.phone}
                onChange={(event) => setSupplier({ ...supplier, phone: event.target.value })}
                placeholder="9812999000"
                style={inputStyle()}
              />
            </Field>
          </FormPanel>

          <FormPanel title="Supplier Rate" onSubmit={submitRate} isSaving={isSaving}>
            <Field label="Product">
              <select
                value={rate.productId}
                onChange={(event) => setRate({ ...rate, productId: event.target.value })}
                disabled={!canSaveRate}
                required
                style={inputStyle()}
              >
                {catalog.products.map((catalogProduct) => (
                  <option key={catalogProduct.id} value={catalogProduct.id}>
                    {catalogProduct.sku} - {catalogProduct.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Supplier">
              <select
                value={rate.supplierId}
                onChange={(event) => setRate({ ...rate, supplierId: event.target.value })}
                disabled={!canSaveRate}
                required
                style={inputStyle()}
              >
                {catalog.suppliers.map((catalogSupplier) => (
                  <option key={catalogSupplier.id} value={catalogSupplier.id}>
                    {catalogSupplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Supplier SKU">
              <input
                value={rate.supplierSku}
                onChange={(event) => setRate({ ...rate, supplierSku: event.target.value })}
                placeholder="NAR-TEA-MILK-500"
                style={inputStyle()}
              />
            </Field>
            <Field label="Supplier price NPR">
              <input
                value={rate.supplierPrice}
                onChange={(event) =>
                  setRate({ ...rate, supplierPrice: event.target.value })
                }
                placeholder="285.00"
                required
                inputMode="decimal"
                style={inputStyle()}
              />
            </Field>
            <Field label="Available stock">
              <input
                value={rate.availableStock}
                onChange={(event) =>
                  setRate({ ...rate, availableStock: event.target.value })
                }
                placeholder="45"
                required
                inputMode="numeric"
                style={inputStyle()}
              />
            </Field>
          </FormPanel>
        </section>

        <section
          style={{
            border: "1px solid #e1d7c8",
            borderRadius: 8,
            background: "#fffdf8",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 16, borderBottom: "1px solid #e1d7c8" }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Current Catalog</h2>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#5f6b62" }}>
                  <th style={{ padding: 14 }}>SKU</th>
                  <th style={{ padding: 14 }}>Product</th>
                  <th style={{ padding: 14 }}>Base</th>
                  <th style={{ padding: 14 }}>Supplier rates</th>
                </tr>
              </thead>
              <tbody>
                {catalog.products.map((catalogProduct) => (
                  <tr key={catalogProduct.id} style={{ borderTop: "1px solid #eee5d8" }}>
                    <td style={{ padding: 14, fontWeight: 900 }}>{catalogProduct.sku}</td>
                    <td style={{ padding: 14 }}>
                      <div style={{ fontWeight: 800 }}>{catalogProduct.name}</div>
                      <div style={{ marginTop: 3, color: "#697569", fontSize: 13 }}>
                        {catalogProduct.description || "No description"}
                      </div>
                    </td>
                    <td style={{ padding: 14, fontWeight: 800 }}>
                      NPR {catalogProduct.price}
                    </td>
                    <td style={{ padding: 14 }}>
                      {catalogProduct.supplierRates.length === 0 ? (
                        <span style={{ color: "#8a6b52" }}>No supplier rate</span>
                      ) : (
                        <div style={{ display: "grid", gap: 5 }}>
                          {catalogProduct.supplierRates.map((supplierRate) => (
                            <span key={supplierRate.id}>
                              {supplierRate.supplierName}: NPR{" "}
                              {supplierRate.supplierPrice}, stock{" "}
                              {supplierRate.availableStock}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
