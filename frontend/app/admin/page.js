import Link from "next/link";
import { getBackendBaseUrl } from "../../lib/backend-base-url";

export const dynamic = "force-dynamic";

function MetricCard({ label, value, accent }) {
  return (
    <article
      style={{
        borderRadius: 22,
        padding: 22,
        background: accent,
        color: "#fff9f1",
        boxShadow: "0 18px 40px rgba(47, 28, 11, 0.12)",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          opacity: 0.82,
        }}
      >
        {label}
      </p>
      <h2
        style={{
          margin: "14px 0 0",
          fontSize: "clamp(2rem, 4vw, 3rem)",
          lineHeight: 1,
        }}
      >
        {value}
      </h2>
    </article>
  );
}

function SectionCard({ title, children }) {
  return (
    <section
      style={{
        background: "rgba(255, 252, 247, 0.94)",
        borderRadius: 26,
        padding: 24,
        border: "1px solid rgba(107, 78, 42, 0.12)",
        boxShadow: "0 18px 40px rgba(60, 41, 15, 0.08)",
      }}
    >
      <h2
        style={{
          margin: "0 0 18px",
          fontSize: 22,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyState({ children }) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: 18,
        background: "#f8f1e8",
        color: "#76553a",
      }}
    >
      {children}
    </div>
  );
}

async function loadOverview() {
  const response = await fetch(`${getBackendBaseUrl()}/api/admin/overview`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to load admin overview.");
  }

  return response.json();
}

export default async function AdminPage() {
  let overview = null;
  let error = "";

  try {
    overview = await loadOverview();
  } catch (requestError) {
    error = requestError.message || "Unable to load admin overview.";
  }

  const metrics = overview?.metrics;
  const orders = overview?.orders || [];
  const products = overview?.products || [];

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 18px 48px",
      }}
    >
      <section
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg, #7a3714 0%, #1d3d32 50%, #0d6b61 100%)",
            color: "#fff8f0",
            borderRadius: 30,
            padding: "28px 24px",
            boxShadow: "0 30px 60px rgba(45, 28, 12, 0.18)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              opacity: 0.82,
            }}
          >
            Khaacho Commerce Agent OS
          </p>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/chat"
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: "#f4dfc5",
                color: "#7a3714",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Chat Simulator
            </Link>
            <Link
              href="/admin"
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.16)",
                color: "#fff8f0",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Admin
            </Link>
            <Link
              href="/admin/catalog"
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: "#dfeadf",
                color: "#1f4b39",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Catalog & Rates
            </Link>
            <Link
              href="/admin/growth"
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: "#f4dfc5",
                color: "#7a3714",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Growth Agent
            </Link>
          </div>
          <h1
            style={{
              margin: "12px 0 10px",
              fontSize: "clamp(2rem, 4vw, 3.8rem)",
              lineHeight: 1,
            }}
          >
            Admin Dashboard
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 780,
              fontSize: 17,
              lineHeight: 1.6,
              opacity: 0.92,
            }}
          >
            Live overview of retailers, suppliers, products, and recent orders
            coming directly from the PostgreSQL-backed backend API.
          </p>
        </div>

        {error ? (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 16,
              background: "#fff1ec",
              color: "#8c2f15",
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <MetricCard
            label="Retailers"
            value={metrics ? metrics.totalRetailers : "0"}
            accent="linear-gradient(135deg, #1f4b39 0%, #285b44 100%)"
          />
          <MetricCard
            label="Suppliers"
            value={metrics ? metrics.totalSuppliers : "0"}
            accent="linear-gradient(135deg, #9f5125 0%, #c06a34 100%)"
          />
          <MetricCard
            label="Products"
            value={metrics ? metrics.totalProducts : "0"}
            accent="linear-gradient(135deg, #51672d 0%, #738f40 100%)"
          />
          <MetricCard
            label="Orders"
            value={metrics ? metrics.totalOrders : "0"}
            accent="linear-gradient(135deg, #224d66 0%, #347196 100%)"
          />
          <MetricCard
            label="Revenue"
            value={metrics ? `NPR ${metrics.totalRevenue}` : "NPR 0.00"}
            accent="linear-gradient(135deg, #5c2e5f 0%, #7e4383 100%)"
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 0.85fr)",
          }}
        >
          <SectionCard title="Recent Orders">
            {orders.length === 0 ? (
              <EmptyState>No orders are in the database yet.</EmptyState>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 680,
                  }}
                >
                  <thead>
                    <tr style={{ textAlign: "left", color: "#6f5d4c" }}>
                      <th style={{ padding: "0 0 12px" }}>Customer</th>
                      <th style={{ padding: "0 0 12px" }}>Status</th>
                      <th style={{ padding: "0 0 12px" }}>Items</th>
                      <th style={{ padding: "0 0 12px" }}>Total</th>
                      <th style={{ padding: "0 0 12px" }}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} style={{ borderTop: "1px solid #e7dccb" }}>
                        <td style={{ padding: "14px 0" }}>
                          <div style={{ fontWeight: 700 }}>{order.customerName}</div>
                          <div style={{ color: "#7a6857", fontSize: 13 }}>
                            {order.customerEmail}
                          </div>
                        </td>
                        <td style={{ padding: "14px 0" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "7px 10px",
                              borderRadius: 999,
                              background: "#e9f1ea",
                              color: "#23533c",
                              fontSize: 12,
                              fontWeight: 800,
                              letterSpacing: "0.06em",
                            }}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td style={{ padding: "14px 0", fontWeight: 700 }}>
                          {order.itemCount}
                        </td>
                        <td style={{ padding: "14px 0", fontWeight: 700 }}>
                          NPR {order.totalAmount}
                        </td>
                        <td style={{ padding: "14px 0", color: "#6f5d4c" }}>
                          {new Date(order.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Catalog Snapshot">
            {products.length === 0 ? (
              <EmptyState>No products were returned from the backend.</EmptyState>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {products.slice(0, 8).map((product) => (
                  <article
                    key={product.id}
                    style={{
                      padding: 16,
                      borderRadius: 18,
                      background: "#f9f4ec",
                      border: "1px solid #eadfcf",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "start",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            color: "#7a6857",
                          }}
                        >
                          {product.sku}
                        </div>
                        <h3 style={{ margin: "6px 0 4px", fontSize: 18 }}>
                          {product.name}
                        </h3>
                      </div>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "#7a3714",
                        }}
                      >
                        NPR {product.price}
                      </div>
                    </div>
                    <p style={{ margin: "10px 0 0", color: "#665547", lineHeight: 1.5 }}>
                      {product.cheapestSupplier
                        ? `Cheapest supplier: ${product.cheapestSupplier.supplierName} at NPR ${product.cheapestSupplier.supplierPrice}.`
                        : "No supplier pricing linked yet."}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Full Product List">
          {products.length === 0 ? (
            <EmptyState>No products are available yet.</EmptyState>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 760,
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", color: "#6f5d4c" }}>
                    <th style={{ padding: "0 0 12px" }}>SKU</th>
                    <th style={{ padding: "0 0 12px" }}>Product</th>
                    <th style={{ padding: "0 0 12px" }}>Base Price</th>
                    <th style={{ padding: "0 0 12px" }}>Supplier Count</th>
                    <th style={{ padding: "0 0 12px" }}>Cheapest Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} style={{ borderTop: "1px solid #e7dccb" }}>
                      <td style={{ padding: "14px 0", fontWeight: 800 }}>{product.sku}</td>
                      <td style={{ padding: "14px 0" }}>
                        <div style={{ fontWeight: 700 }}>{product.name}</div>
                        <div style={{ color: "#7a6857", fontSize: 13 }}>
                          {product.description || "No description"}
                        </div>
                      </td>
                      <td style={{ padding: "14px 0", fontWeight: 700 }}>
                        NPR {product.price}
                      </td>
                      <td style={{ padding: "14px 0", fontWeight: 700 }}>
                        {product.supplierCount}
                      </td>
                      <td style={{ padding: "14px 0", color: "#5d4e41" }}>
                        {product.cheapestSupplier
                          ? `${product.cheapestSupplier.supplierName} - NPR ${product.cheapestSupplier.supplierPrice}`
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </section>
    </main>
  );
}
