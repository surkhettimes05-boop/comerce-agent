"use client";

import { useState } from "react";

const CHAT_ENDPOINT = "/api/chat";
const DEMO_CUSTOMER_EMAIL = "retailer.kathmandu@example.com";

const SAMPLE_PROMPTS = [
  "Need Wai Wai Chicken noodles",
  "Compare Coke 1L supplier prices",
  "I want to order 10 cartons of Wai Wai tomorrow",
];

function ProductSummary({ payload }) {
  const products = Array.isArray(payload?.data?.products) ? payload.data.products : [];

  if (products.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        marginTop: 12,
      }}
    >
      {products.slice(0, 2).map((product) => (
        <div
          key={product.productId || product.sku}
          style={{
            border: "1px solid #d9e4dc",
            borderRadius: 8,
            padding: 12,
            background: "#fbfdf9",
          }}
        >
          <div style={{ fontWeight: 800, color: "#173d2b" }}>{product.name}</div>
          <div style={{ marginTop: 4, color: "#5d6d62", fontSize: 13 }}>
            {product.sku} - Base NPR {product.basePrice}
          </div>
          {product.cheapestSupplier ? (
            <div style={{ marginTop: 8, fontWeight: 700, color: "#8a451e" }}>
              Best supplier: {product.cheapestSupplier.supplierName}, NPR{" "}
              {product.cheapestSupplier.supplierPrice}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function OrderConfirmation({ payload, onConfirm, isSending }) {
  const orderDraft = payload?.data;

  if (
    payload?.route?.agentIntent !== "CREATE_ORDER" ||
    orderDraft?.status !== "needs_confirmation" ||
    !orderDraft?.draftId
  ) {
    return null;
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        marginTop: 12,
        border: "1px solid #d9e4dc",
        borderRadius: 8,
        padding: 12,
        background: "#fbfdf9",
      }}
    >
      <div style={{ fontWeight: 900, color: "#173d2b" }}>Order confirmation</div>
      {orderDraft.items.map((item) => (
        <div key={item.productId} style={{ color: "#31443a", lineHeight: 1.45 }}>
          {item.quantity} {item.packagingUnit || "unit"} {item.name} - NPR{" "}
          {item.lineTotal}
        </div>
      ))}
      <div style={{ fontWeight: 900, color: "#8a451e" }}>
        Total NPR {orderDraft.totalAmount}
      </div>
      <button
        type="button"
        onClick={() => onConfirm(orderDraft.draftId)}
        disabled={isSending}
        style={{
          justifySelf: "start",
          border: 0,
          borderRadius: 8,
          padding: "10px 14px",
          background: isSending ? "#8f8a82" : "#1f4f39",
          color: "#fffaf0",
          fontWeight: 900,
          cursor: isSending ? "wait" : "pointer",
        }}
      >
        Confirm order
      </button>
    </div>
  );
}

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [transcript, setTranscript] = useState([
    {
      role: "assistant",
      text:
        "Namaste. Tell me what you need for your store and I can find products, compare supplier prices, or prepare an order for confirmation.",
    },
  ]);
  const [lastResponse, setLastResponse] = useState(null);
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendMessage(userMessage) {
    const trimmedMessage = userMessage.trim();

    if (!trimmedMessage) {
      return;
    }

    setIsSending(true);
    setError("");
    setTranscript((current) => [
      ...current,
      { role: "user", text: trimmedMessage },
    ]);

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: DEMO_CUSTOMER_EMAIL,
          message: trimmedMessage,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to reach the commerce assistant.");
      }

      setLastResponse(payload);
      setTranscript((current) => [
        ...current,
        {
          role: "assistant",
          text: payload.reply,
          payload,
        },
      ]);
      setMessage("");
    } catch (requestError) {
      setError(requestError.message || "Unable to reach the commerce assistant.");
    } finally {
      setIsSending(false);
    }
  }

  async function confirmOrder(draftId) {
    setIsSending(true);
    setError("");

    try {
      const response = await fetch(`/api/orders/drafts/${draftId}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userEmail: DEMO_CUSTOMER_EMAIL,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to confirm order.");
      }

      setTranscript((current) => [
        ...current,
        {
          role: "assistant",
          text: `Order confirmed. Your order total is NPR ${payload.totalAmount}.`,
          payload: {
            data: payload,
          },
        },
      ]);
    } catch (confirmError) {
      setError(confirmError.message || "Unable to confirm order.");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage(message);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f2e8",
        color: "#1f2e26",
      }}
    >
      <section
        style={{
          minHeight: "100vh",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          maxWidth: 920,
          margin: "0 auto",
          padding: "18px 14px",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 2px 18px",
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#173d2b" }}>
              Khaacho
            </div>
            <div style={{ marginTop: 2, color: "#667468", fontSize: 13 }}>
              Commerce assistant for Kathmandu Kirana Store
            </div>
          </div>
          <div
            style={{
              borderRadius: 999,
              padding: "8px 12px",
              background: "#dfeadf",
              color: "#214f38",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            Online
          </div>
        </header>

        <div
          style={{
            overflow: "auto",
            borderTop: "1px solid #e0d7c8",
            borderBottom: "1px solid #e0d7c8",
            padding: "18px 0",
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            {transcript.map((entry, index) => {
              const isUser = entry.role === "user";

              return (
                <article
                  key={`${entry.role}-${index}`}
                  style={{
                    maxWidth: isUser ? "78%" : "88%",
                    justifySelf: isUser ? "end" : "start",
                    borderRadius: 8,
                    padding: "13px 14px",
                    background: isUser ? "#1f4f39" : "#fffdf8",
                    color: isUser ? "#fffaf0" : "#24342c",
                    border: isUser ? "1px solid #1f4f39" : "1px solid #e2d8ca",
                    boxShadow: "0 10px 24px rgba(50, 38, 23, 0.07)",
                  }}
                >
                  <p style={{ margin: 0, lineHeight: 1.55 }}>{entry.text}</p>
                  {!isUser ? <ProductSummary payload={entry.payload} /> : null}
                  {!isUser ? (
                    <OrderConfirmation
                      payload={entry.payload}
                      onConfirm={confirmOrder}
                      isSending={isSending}
                    />
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>

        <footer style={{ paddingTop: 14 }}>
          {lastResponse?.route?.agentIntent ? (
            <div
              style={{
                marginBottom: 10,
                color: "#627166",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Last request: {lastResponse.route.agentIntent.replace("_", " ").toLowerCase()}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 10,
            }}
          >
            {SAMPLE_PROMPTS.map((samplePrompt) => (
              <button
                key={samplePrompt}
                type="button"
                onClick={() => sendMessage(samplePrompt)}
                disabled={isSending}
                style={{
                  flex: "0 0 auto",
                  border: "1px solid #d4c7b6",
                  borderRadius: 999,
                  padding: "9px 12px",
                  background: "#fffaf2",
                  color: "#4c3a27",
                  fontWeight: 700,
                  cursor: isSending ? "wait" : "pointer",
                }}
              >
                {samplePrompt}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 10,
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#526158" }}>
                Message
              </span>
              <textarea
                rows={2}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask for products, prices, or order help"
                style={{
                  minHeight: 52,
                  maxHeight: 130,
                  padding: "13px 14px",
                  borderRadius: 8,
                  border: "1px solid #cbbca9",
                  fontSize: 15,
                  resize: "vertical",
                  background: "#fffdf8",
                  color: "#1f2e26",
                }}
              />
            </label>
            <button
              type="submit"
              disabled={isSending || !message.trim()}
              style={{
                minWidth: 96,
                height: 52,
                border: 0,
                borderRadius: 8,
                padding: "0 18px",
                background:
                  isSending || !message.trim() ? "#9c9a92" : "#a84e23",
                color: "#fffaf0",
                fontSize: 15,
                fontWeight: 900,
                cursor: isSending || !message.trim() ? "not-allowed" : "pointer",
              }}
            >
              {isSending ? "Sending" : "Send"}
            </button>
          </form>

          {error ? (
            <div
              style={{
                marginTop: 10,
                padding: "11px 12px",
                borderRadius: 8,
                background: "#fff1ec",
                color: "#8c2f15",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : null}
        </footer>
      </section>
    </main>
  );
}
