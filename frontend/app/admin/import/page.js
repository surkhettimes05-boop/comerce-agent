"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const SAMPLE_IMPORT = [
  "supplier,sku,name,basePrice,supplierPrice,stock,description",
  "Narayani Fresh Supply,TEA-MILK-500,Milk Tea Premix 500g,310,285,45,Premix for tea shops",
  "Bagmati Supply House,CK-500-PET,Coca-Cola PET Bottle 500ml,60,54,120,Fast-moving bottled soft drink",
].join("\n");

async function readJson(response) {
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || payload.errors?.join(" ") || "Request failed.");
  }

  return payload;
}

export default function ImportPage() {
  const [text, setText] = useState(SAMPLE_IMPORT);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  const readyRows = useMemo(
    () => (preview?.rows || []).filter((row) => row.status === "ready"),
    [preview],
  );

  async function handlePreview(event) {
    event.preventDefault();
    setIsWorking(true);
    setStatus("");
    setError("");

    try {
      const payload = await readJson(
        await fetch("/api/admin/import/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        }),
      );

      setPreview(payload);
      setStatus(`Preview ready: ${payload.summary.readyRows} ready, ${payload.summary.reviewRows} need review.`);
    } catch (previewError) {
      setPreview(null);
      setError(previewError.message || "Unable to preview import.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleImport() {
    setIsWorking(true);
    setStatus("");
    setError("");

    try {
      const payload = await readJson(
        await fetch("/api/admin/import/commit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rows: preview.rows }),
        }),
      );

      setStatus(`Imported ${payload.importedRows} rows. Customer chat can use the new rates now.`);
    } catch (importError) {
      setError(importError.message || "Unable to import rows.");
    } finally {
      setIsWorking(false);
    }
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
              Khaacho Import Agent
            </p>
            <h1 style={{ margin: "6px 0 0", fontSize: 34 }}>
              Import Supplier Price Data
            </h1>
          </div>
          <nav style={{ display: "flex", gap: 10 }}>
            <Link href="/admin/catalog" style={{ color: "#1f4f39", fontWeight: 800 }}>
              Catalog
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

        <form
          onSubmit={handlePreview}
          style={{
            display: "grid",
            gap: 12,
            border: "1px solid #e1d7c8",
            borderRadius: 8,
            padding: 16,
            background: "#fffdf8",
          }}
        >
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#516055" }}>
              Paste CSV price list
            </span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={9}
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #cbbca9",
                borderRadius: 8,
                padding: 12,
                background: "#fffaf2",
                color: "#1f2e26",
                fontFamily: "monospace",
                fontSize: 13,
              }}
            />
          </label>
          <button
            type="submit"
            disabled={isWorking}
            style={{
              justifySelf: "start",
              border: 0,
              borderRadius: 8,
              padding: "12px 16px",
              background: isWorking ? "#8f8a82" : "#1f4f39",
              color: "#fffaf0",
              fontWeight: 900,
              cursor: isWorking ? "wait" : "pointer",
            }}
          >
            {isWorking ? "Working" : "Preview import"}
          </button>
        </form>

        {preview ? (
          <section
            style={{
              border: "1px solid #e1d7c8",
              borderRadius: 8,
              background: "#fffdf8",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                padding: 16,
                borderBottom: "1px solid #e1d7c8",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Preview</h2>
                <p style={{ margin: "4px 0 0", color: "#667468" }}>
                  {preview.summary.readyRows} ready, {preview.summary.reviewRows} need review
                </p>
              </div>
              <button
                type="button"
                onClick={handleImport}
                disabled={isWorking || readyRows.length === 0}
                style={{
                  border: 0,
                  borderRadius: 8,
                  padding: "12px 16px",
                  background: isWorking || readyRows.length === 0 ? "#8f8a82" : "#a84e23",
                  color: "#fffaf0",
                  fontWeight: 900,
                  cursor: isWorking || readyRows.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Import ready rows
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#5f6b62" }}>
                    <th style={{ padding: 12 }}>Status</th>
                    <th style={{ padding: 12 }}>Supplier</th>
                    <th style={{ padding: 12 }}>SKU</th>
                    <th style={{ padding: 12 }}>Product</th>
                    <th style={{ padding: 12 }}>Base</th>
                    <th style={{ padding: 12 }}>Supplier price</th>
                    <th style={{ padding: 12 }}>Stock</th>
                    <th style={{ padding: 12 }}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber} style={{ borderTop: "1px solid #eee5d8" }}>
                      <td style={{ padding: 12, fontWeight: 900 }}>
                        {row.status === "ready" ? "Ready" : "Review"}
                      </td>
                      <td style={{ padding: 12 }}>{row.data.supplier}</td>
                      <td style={{ padding: 12, fontWeight: 800 }}>{row.data.sku}</td>
                      <td style={{ padding: 12 }}>{row.data.name}</td>
                      <td style={{ padding: 12 }}>NPR {row.data.basePrice || "-"}</td>
                      <td style={{ padding: 12 }}>NPR {row.data.supplierPrice || "-"}</td>
                      <td style={{ padding: 12 }}>{row.data.stock ?? "-"}</td>
                      <td style={{ padding: 12, color: "#8c2f15" }}>
                        {row.errors.length > 0 ? row.errors.join("; ") : "OK"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
