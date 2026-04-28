"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const CHAT_ENDPOINT = "/api/chat";

const SAMPLE_PROMPTS = [
  "Need Wai Wai Chicken noodles",
  "Compare Coke 1L supplier prices",
  "I want to order 10 cartons of Wai Wai tomorrow",
];

function extractEntities(payload) {
  const products = Array.isArray(payload?.data?.products) ? payload.data.products : [];
  const entities = [];

  for (const product of products) {
    entities.push({
      type: "product",
      label: `${product.name} (${product.sku})`,
    });

    if (product.cheapestSupplier) {
      entities.push({
        type: "supplier",
        label: `${product.cheapestSupplier.supplierName} - NPR ${product.cheapestSupplier.supplierPrice}`,
      });
    }
  }

  return entities;
}

function IntentBadge({ intent }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        background: "#204f3d",
        color: "#f7f4ed",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.06em",
      }}
    >
      {intent || "UNKNOWN"}
    </span>
  );
}

export default function ChatPage() {
  const [customerEmail, setCustomerEmail] = useState(
    "retailer.kathmandu@example.com",
  );
  const [message, setMessage] = useState("Need Wai Wai Chicken noodles");
  const [transcript, setTranscript] = useState([]);
  const [lastResponse, setLastResponse] = useState(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  const entities = useMemo(() => extractEntities(lastResponse), [lastResponse]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!customerEmail.trim() || !message.trim()) {
      setError("Customer email and message are required.");
      return;
    }

    const userMessage = message.trim();

    setIsSending(true);
    setError("");
    setTranscript((current) => [...current, { role: "user", text: userMessage }]);

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: customerEmail.trim(),
          message: userMessage,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Chat request failed.");
      }

      setLastResponse(payload);
      setTranscript((current) => [
        ...current,
        {
          role: "assistant",
          text: payload.reply,
          intent: payload.route?.agentIntent || "UNKNOWN",
        },
      ]);
      setMessage("");
    } catch (requestError) {
      setError(requestError.message || "Unable to send message.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 18px 48px",
      }}
    >
      <section
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #1d3d32 0%, #9f5125 100%)",
            color: "#fff8f0",
            borderRadius: 28,
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
                background: "rgba(255,255,255,0.16)",
                color: "#fff8f0",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Chat
            </Link>
            <Link
              href="/admin"
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: "#f4dfc5",
                color: "#7a3714",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Admin Dashboard
            </Link>
          </div>
          <h1
            style={{
              margin: "12px 0 10px",
              fontSize: "clamp(2rem, 4vw, 3.6rem)",
              lineHeight: 1,
            }}
          >
            Chat Simulator
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
            Send a seeded retailer message to the backend, route it through the
            master agent, and inspect the reply, intent, and extracted commerce
            entities in one place.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
          }}
        >
          <div
            style={{
              background: "rgba(255, 252, 247, 0.92)",
              borderRadius: 24,
              padding: 24,
              border: "1px solid rgba(107, 78, 42, 0.12)",
              boxShadow: "0 18px 40px rgba(60, 41, 15, 0.08)",
            }}
          >
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>Seeded Customer Email</span>
                <input
                  value={customerEmail}
                  onChange={(event) => setCustomerEmail(event.target.value)}
                  placeholder="retailer.kathmandu@example.com"
                  style={{
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: "1px solid #cdbca8",
                    fontSize: 15,
                    background: "#fffdf9",
                  }}
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 700 }}>Message</span>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Ask about products, prices, or create an order."
                  style={{
                    padding: "16px",
                    borderRadius: 18,
                    border: "1px solid #cdbca8",
                    fontSize: 15,
                    resize: "vertical",
                    background: "#fffdf9",
                  }}
                />
              </label>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {SAMPLE_PROMPTS.map((samplePrompt) => (
                  <button
                    key={samplePrompt}
                    type="button"
                    onClick={() => setMessage(samplePrompt)}
                    style={{
                      border: 0,
                      borderRadius: 999,
                      padding: "10px 14px",
                      background: "#efe3d0",
                      color: "#5a3920",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {samplePrompt}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={isSending}
                style={{
                  border: 0,
                  borderRadius: 18,
                  padding: "16px 18px",
                  background: isSending ? "#8f8a82" : "#a94e23",
                  color: "#fff9f1",
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: isSending ? "wait" : "pointer",
                }}
              >
                {isSending ? "Sending..." : "Send To Agent"}
              </button>
            </form>

            {error ? (
              <div
                style={{
                  marginTop: 16,
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

            <div style={{ marginTop: 24, display: "grid", gap: 14 }}>
              {transcript.length === 0 ? (
                <div
                  style={{
                    borderRadius: 18,
                    padding: 18,
                    background: "#f8f1e8",
                    color: "#76553a",
                  }}
                >
                  The conversation will appear here after you send a message.
                </div>
              ) : null}

              {transcript.map((entry, index) => (
                <article
                  key={`${entry.role}-${index}`}
                  style={{
                    borderRadius: 20,
                    padding: 18,
                    background:
                      entry.role === "user"
                        ? "#f3decb"
                        : "linear-gradient(135deg, #fdf8ef 0%, #eef7f2 100%)",
                    alignSelf: entry.role === "user" ? "end" : "stretch",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <strong style={{ fontSize: 13, letterSpacing: "0.06em" }}>
                      {entry.role === "user" ? "CUSTOMER" : "AGENT"}
                    </strong>
                    {entry.intent ? <IntentBadge intent={entry.intent} /> : null}
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>{entry.text}</p>
                </article>
              ))}
            </div>
          </div>

          <aside
            style={{
              display: "grid",
              gap: 18,
              alignContent: "start",
            }}
          >
            <section
              style={{
                background: "rgba(255, 252, 247, 0.92)",
                borderRadius: 24,
                padding: 22,
                border: "1px solid rgba(107, 78, 42, 0.12)",
                boxShadow: "0 18px 40px rgba(60, 41, 15, 0.08)",
              }}
            >
              <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>Intent</h2>
              {lastResponse ? (
                <IntentBadge intent={lastResponse.route?.agentIntent} />
              ) : (
                <p style={{ margin: 0, color: "#786756" }}>
                  No intent yet. Send a message first.
                </p>
              )}
            </section>

            <section
              style={{
                background: "rgba(255, 252, 247, 0.92)",
                borderRadius: 24,
                padding: 22,
                border: "1px solid rgba(107, 78, 42, 0.12)",
                boxShadow: "0 18px 40px rgba(60, 41, 15, 0.08)",
              }}
            >
              <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>Entities</h2>
              {entities.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {entities.map((entity, index) => (
                    <span
                      key={`${entity.type}-${index}`}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 14,
                        background:
                          entity.type === "product" ? "#e9f1ea" : "#f6e7db",
                        color: entity.type === "product" ? "#22513a" : "#8b4b20",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {entity.type}: {entity.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, color: "#786756" }}>
                  Matching products and suppliers will appear here.
                </p>
              )}
            </section>

            <section
              style={{
                background: "rgba(29, 61, 50, 0.96)",
                color: "#f8f4eb",
                borderRadius: 24,
                padding: 22,
                boxShadow: "0 18px 40px rgba(30, 39, 34, 0.16)",
              }}
            >
              <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>Backend</h2>
              <p style={{ margin: "0 0 8px", lineHeight: 1.6 }}>
                Requests are sent to:
              </p>
              <code
                style={{
                  display: "block",
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.08)",
                  overflowWrap: "anywhere",
                }}
              >
                {CHAT_ENDPOINT} (proxied to the backend)
              </code>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
