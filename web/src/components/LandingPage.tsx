import { Component } from 'solid-js'

const LandingPage: Component = () => {
  return (
    <div class="landing-page">
      <header class="hero">
        <h1>Scan Files to SerenAI</h1>
        <p class="tagline">
          Query document databases via x402 micropayments
        </p>
      </header>

      <section class="about">
        <h2>About This Project</h2>
        <p>
          This open-source application demonstrates SerenAI's micropayment capabilities
          by providing queryable access to document databases.
        </p>
        <p>
          Documents are extracted from images and PDFs using OCR technology and
          stored in SerenDB, making them searchable and accessible through SQL queries with
          micropayment integration.
        </p>
      </section>

      <section class="how-it-works">
        <h2>How It Works</h2>
        <div class="steps">
          <div class="step">
            <h3>1. Extract & Upload</h3>
            <p>
              Documents are extracted from PDFs and images using OCR tools
              and uploaded to SerenDB (PostgreSQL-compatible database).
            </p>
          </div>
          <div class="step">
            <h3>2. Register Provider</h3>
            <p>
              The database is registered as an x402 payment provider at the SerenDB gateway,
              enabling micropayment-gated queries.
            </p>
          </div>
          <div class="step">
            <h3>3. Query with Payments</h3>
            <p>
              LLMs and users can query the database through the MCP server. Each query
              requires a small micropayment (starting at $0.01 per 1000 rows).
            </p>
          </div>
        </div>
      </section>

      <section class="payment-flow">
        <h2>Payment Flow</h2>
        <p>
          Queries are priced based on the amount of data returned:
        </p>
        <ul>
          <li><strong>Base Price:</strong> $0.01 per 1000 rows</li>
          <li><strong>Example:</strong> A query returning 100 rows costs approximately $0.001</li>
          <li><strong>Payment Protocol:</strong> x402 (HTTP 402 Payment Required)</li>
          <li><strong>Wallet:</strong> Ethereum-compatible addresses supported</li>
        </ul>
        <p>
          When a query requires payment, the system returns a payment URL. Complete the
          payment to execute your query and receive the results.
        </p>
      </section>

      <section class="tech-stack">
        <h2>Technology Stack</h2>
        <ul>
          <li><strong>Frontend:</strong> SolidJS (reactive UI framework)</li>
          <li><strong>Database:</strong> SerenDB (PostgreSQL-compatible)</li>
          <li><strong>Payment Protocol:</strong> x402 micropayments</li>
          <li><strong>LLM Integration:</strong> MCP (Model Context Protocol) server</li>
          <li><strong>OCR:</strong> Open-source text extraction tools</li>
        </ul>
      </section>

      <section class="source-info">
        <h2>Getting Started</h2>
        <p>
          Fork this project and upload your own documents to create a queryable database:
        </p>
        <ul>
          <li>Place PDFs and images in the <code>docs/Documents/</code> folder</li>
          <li>Run the extraction script to process documents with OCR</li>
          <li>Upload extracted content to your SerenDB instance</li>
          <li>Register your database as an x402 payment provider</li>
          <li>Query via MCP server or web interface</li>
        </ul>
      </section>

      <footer class="footer">
        <p>
          This is an open-source demonstration project.
          View the source code and documentation on GitHub.
        </p>
      </footer>
    </div>
  )
}

export default LandingPage
