export const metadata = {
  title: "Khaacho Commerce Chat",
  description: "Chat interface for the Khaacho Commerce Agent OS.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top, #fff5dc 0%, #f5efe3 42%, #efe8da 100%)",
          color: "#1f1a14",
          fontFamily:
            '"Segoe UI", "Trebuchet MS", "Gill Sans", system-ui, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
