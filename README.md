# RTLGDS Cost Estimator

A full-stack web application for estimating the cost of RTL to GDS (RTLGDS) projects with separate admin and customer interfaces.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: NestJS + TypeScript
- **Authentication**: JWT-based authentication
- **Storage**: In-memory (no database required)

## Features

- **Two User Profiles:**
  - **Admin**: Edit and manage all configuration parameters via REST API
  - **Customer**: Configure projects and view cost estimates

- **Project Configuration:**
  - Project name and technology selection
  - Full chip configuration (optional)
  - Multiple block configurations
  - Dynamic form generation based on selections

- **Automatic Cost Calculation:**
  - Real-time cost updates as configuration changes
  - Based on resources, timeline, and complexity factors
  - Cost displayed in top-right corner
  - API-based calculation

- **Comprehensive Configuration:**
  - Project timeline options
  - Block gate count scaling
  - Block complexity factors
  - Full chip factors
  - DFT (Design for Testability) options
  - Additional factors (I/O pads, clock distribution)

## Installation

### Prerequisites
- Node.js 18+ and npm

### Setup

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```
   Or separately:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. **Start both frontend and backend:**
   ```bash
   npm run dev:all
   ```
   
   Or start separately:
   ```bash
   # Terminal 1 - Backend
   npm run dev:backend
   
   # Terminal 2 - Frontend
   npm run dev
   ```

3. **Access the application:**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /auth/login` - Login with role (admin/customer)

### Configuration (Admin only)
- `GET /config` - Get current configuration
- `PUT /config` - Update configuration
- `POST /config/reset` - Reset to default configuration

### Estimation
- `POST /estimation/calculate` - Calculate project cost (requires authentication)

## Project Structure

```
RTLGDS/
├── backend/                 # NestJS backend
│   ├── src/
│   │   ├── auth/           # Authentication module
│   │   ├── config/         # Configuration module
│   │   ├── estimation/     # Cost estimation module
│   │   ├── types/          # Shared types
│   │   └── main.ts
│   └── package.json
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── context/        # React contexts
│   │   ├── services/       # API service
│   │   └── types.ts
│   ├── public/             # Static assets
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── package.json            # Workspace root
```

## Usage

### Customer Profile

1. Select **Customer** profile on login
2. Enter project details (name, technology, timeline)
3. Configure full chip (if needed)
4. Add and configure blocks
5. View real-time cost estimate in top-right corner

### Admin Profile

1. Select **Admin** profile on login
2. Navigate through configuration sections
3. Edit parameters as needed
4. Click **Save Changes** to update system configuration
5. Click **Reset to Default** to restore original values

## Cost Calculation

The cost is automatically calculated as:
```
Total Cost = Total Resources × Timeline (months) × ₹4,00,000 per resource per month
```

Resources are calculated by:
- Base block resources (0.5 for 1.5M gates)
- Gate count scaling (+10% per additional 1M gates)
- Complexity factors (each adds a percentage multiplier)
- Full chip resources (if enabled)
- Additional factors (applied as multipliers)

## Environment Variables

Create a `.env` file in the backend directory (optional):
```
PORT=3000
JWT_SECRET=your-secret-key-here
```

Create a `.env` file in the frontend directory (optional):
```
VITE_API_URL=http://localhost:3000
```

## Development

- **Backend**: Uses NestJS CLI, hot-reload enabled
- **Frontend**: Uses Vite, hot-reload enabled
- **TypeScript**: Strict type checking enabled
- **CORS**: Configured for local development

## Notes

- All configuration is stored in-memory on the backend
- JWT tokens expire after 24 hours
- Admin changes affect all customer calculations immediately
- Cost updates in real-time as you modify the configuration
