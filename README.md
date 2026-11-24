# 🇱🇰 CSE Analyzer

**A modern stock market analysis platform for the Colombo Stock Exchange (CSE), Sri Lanka.**

CSE Analyzer is a web-based platform designed to help investors explore the Sri Lankan stock market, monitor market movements, analyze listed companies, visualize historical stock performance, and stay updated with company announcements.

Built with Next.js, TypeScript, Tailwind CSS, and Recharts, the platform integrates with publicly available data from the Colombo Stock Exchange.

## ✨ Features

- **Market Overview** – Get an overview of the Colombo Stock Exchange and its market activity.
- **Stocks Explorer** – Browse, search, and explore CSE-listed companies.
- **Stock Details** – View individual stock information, price movements, and historical charts.
- **Sector Analysis** – Explore companies categorized by market sectors.
- **Company Announcements** – Access publicly available company announcements.
- **Interactive Charts** – Visualize stock price movements and market trends.
- **Data Integration** – Retrieve market information through the public CSE API.
- **Server-Side Caching** – Cache server-side API responses for 30 seconds to reduce unnecessary requests.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 14 | React framework and App Router |
| TypeScript | Type safety |
| Tailwind CSS | Styling and responsive UI |
| Recharts | Interactive data visualization |
| CSE Public API | Stock market data |

## 📸 Application Pages

| Page | Route | Description |
|---|---|---|
| Market Overview | `/` | Market summary and key indicators |
| Stocks Explorer | `/stocks` | Browse CSE-listed stocks |
| Stock Details | `/stock/[symbol]` | Individual stock information and charts |
| Sectors | `/sectors` | Explore market sectors |
| Announcements | `/announcements` | Company announcements |

Example stock detail page:

`/stock/LOLC.N0000`

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or later
- npm
- Internet connection

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/kavinduthilan/cse-stock-analyzer.git
   ```

2. Navigate to the project directory:

   ```bash
   cd cse-stock-analyzer
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open your browser:

   ```text
   http://localhost:3000
   ```

## 🏗️ Project Architecture

The application uses Next.js App Router and separates server-side data fetching from client-side chart requests.

- **Server Components:** Fetch data directly from the public CSE API with a 30-second cache.
- **API Proxy:** The `/api/cse/[endpoint]` route forwards chart-related requests to the CSE API, helping avoid browser CORS restrictions.
- **Data Mapping:** `lib/cse.ts` contains the `toRow()` mapping logic for normalizing CSE responses.
- **Flexible Field Extraction:** Pages use `pick()` helpers with fallback fields to handle variations in API response structures.

## 📊 Data Source

Market data is retrieved from the publicly accessible Colombo Stock Exchange website and its API.

**Data source:** [https://www.cse.lk](https://www.cse.lk)

The CSE API response structures are not formally documented. Field mappings and response handling may require adjustments when the upstream API changes.

If a value appears as `–`, inspect the raw API response and update the relevant field mappings.

## ⚠️ Disclaimer

CSE Analyzer is an independent project developed for educational, analytical, and informational purposes.

- This project is not affiliated with or officially endorsed by the Colombo Stock Exchange.
- Market data is provided by publicly accessible CSE data sources and may be delayed, incomplete, or subject to change.
- Information displayed by this application should not be considered financial or investment advice.
- Always verify financial information before making investment decisions.

## 🗺️ Roadmap

Potential future improvements:

- [ ] Fundamental analysis and financial ratios
- [ ] Company financial statement analysis
- [ ] EPS, NAV, PE, PBV, and dividend yield calculations
- [ ] Historical financial performance comparison
- [ ] Stock screening and filtering
- [ ] Intrinsic value and stock valuation models
- [ ] Portfolio tracking and performance analysis
- [ ] AI-powered investment insights
- [ ] Automated financial report extraction

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push the branch.
5. Open a Pull Request.

## 📄 License

This project is open-source. A license will be specified in the repository.