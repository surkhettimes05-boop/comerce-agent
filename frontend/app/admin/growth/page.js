import Link from "next/link";
import { getBackendBaseUrl } from "../../../lib/backend-base-url";

export const dynamic = "force-dynamic";

async function loadCampaigns() {
  const response = await fetch(`${getBackendBaseUrl()}/api/admin/growth/campaigns`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      summary: {
        retailerCount: 0,
        productCount: 0,
        recentOrderCount: 0,
        campaignCount: 0,
      },
      campaigns: [],
      error: "Unable to load growth campaigns.",
    };
  }

  return response.json();
}

function Metric({ label, value }) {
  return (
    <article
      style={{
        border: "1px solid #ded4c6",
        borderRadius: 8,
        padding: 16,
        background: "#fffdf8",
      }}
    >
      <div style={{ color: "#667468", fontSize: 12, fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>{value}</div>
    </article>
  );
}

export default async function GrowthPage() {
  const data = await loadCampaigns();

  return (
    <main style={{ minHeight: "100vh", padding: "24px 16px 48px" }}>
      <section style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 20 }}>
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
              Khaacho Growth Agent
            </p>
            <h1 style={{ margin: "6px 0 0", fontSize: 34 }}>
              Campaign Ideas & Drafts
            </h1>
          </div>
          <nav style={{ display: "flex", gap: 10 }}>
            <Link href="/admin" style={{ color: "#1f4f39", fontWeight: 800 }}>
              Dashboard
            </Link>
            <Link href="/admin/catalog" style={{ color: "#1f4f39", fontWeight: 800 }}>
              Catalog
            </Link>
            <Link href="/chat" style={{ color: "#8a451e", fontWeight: 800 }}>
              Customer chat
            </Link>
          </nav>
        </header>

        {data.error ? (
          <div
            style={{
              borderRadius: 8,
              padding: 12,
              background: "#fff1ec",
              color: "#8c2f15",
              fontWeight: 800,
            }}
          >
            {data.error}
          </div>
        ) : null}

        <section
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <Metric label="Retailers" value={data.summary.retailerCount} />
          <Metric label="Products" value={data.summary.productCount} />
          <Metric label="Recent Orders" value={data.summary.recentOrderCount} />
          <Metric label="Ideas" value={data.summary.campaignCount} />
        </section>

        <section style={{ display: "grid", gap: 14 }}>
          {data.campaigns.length === 0 ? (
            <div
              style={{
                border: "1px solid #ded4c6",
                borderRadius: 8,
                padding: 18,
                background: "#fffdf8",
                color: "#667468",
              }}
            >
              No growth ideas yet. Add catalog rates and orders first.
            </div>
          ) : null}

          {data.campaigns.map((campaign) => (
            <article
              key={campaign.id}
              style={{
                border: "1px solid #ded4c6",
                borderRadius: 8,
                padding: 18,
                background: "#fffdf8",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>{campaign.title}</h2>
                  <p style={{ margin: "5px 0 0", color: "#667468" }}>
                    {campaign.objective}
                  </p>
                </div>
                <div
                  style={{
                    borderRadius: 999,
                    padding: "8px 12px",
                    background: "#e8f3e8",
                    color: "#1f4f39",
                    fontWeight: 900,
                    alignSelf: "start",
                  }}
                >
                  {campaign.targetSegment.count} retailers
                </div>
              </div>

              <div style={{ color: "#3f4f44", lineHeight: 1.5 }}>
                <strong>Reason:</strong> {campaign.reason}
              </div>

              {campaign.product ? (
                <div style={{ color: "#3f4f44" }}>
                  <strong>Product:</strong> {campaign.product.name} ({campaign.product.sku}) - NPR{" "}
                  {campaign.product.customerPrice}
                </div>
              ) : null}

              {campaign.supplier ? (
                <div style={{ color: "#3f4f44" }}>
                  <strong>Supplier:</strong> {campaign.supplier.name} - NPR{" "}
                  {campaign.supplier.supplierPrice}, stock {campaign.supplier.availableStock}
                </div>
              ) : null}

              <div
                style={{
                  border: "1px solid #e8ddce",
                  borderRadius: 8,
                  padding: 14,
                  background: "#fff8ee",
                  lineHeight: 1.55,
                }}
              >
                <strong>Draft message:</strong>
                <p style={{ margin: "8px 0 0" }}>{campaign.suggestedMessage}</p>
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
