import { Component } from 'solid-js'

const LandingPage: Component = () => {
  return (
    <div class="landing-page">
      <header class="hero">
        <h1>Epstein Files Database</h1>
        <p class="tagline">
          Query congressional oversight documents via x402 micropayments
        </p>
      </header>

      <section class="about">
        <h2>About This Project</h2>
        <p>
          This open-source application demonstrates SerenAI's micropayment capabilities
          by providing queryable access to Epstein Files documents released by the House
          Oversight Committee.
        </p>
        <p>
          The documents have been extracted from images and PDFs using OCR technology and
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
              Documents are extracted from oversight committee archives using OCR tools
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
        <h2>Document Sources</h2>
        <p>
          All documents are from official House Oversight Committee releases:
        </p>
        <ul>
          <li>
            <a
              href="https://oversight.house.gov/release/oversight-committee-releases-epstein-records-provided-by-the-department-of-justice/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Epstein Records from DOJ
            </a>
          </li>
          <li>
            <a
              href="https://oversight.house.gov/release/oversight-committee-releases-additional-epstein-estate-documents/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Additional Epstein Estate Documents
            </a>
          </li>
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
