export const metadata = {
  title: "Exam Forge",
  description: "Generate beautiful exams from your lectures and export to Canvas (QTI)."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{padding: "2rem"}}>
        <main className="container">{children}</main>
        <footer style={{marginTop:"3rem", fontSize:"0.9rem", opacity:0.7}}>
          Exam Forge · Canvas QTI export · Powered by your local LLM
        </footer>
      </body>
    </html>
  );
}
