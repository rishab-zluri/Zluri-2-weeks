# Zluri SRE Internal Portal - Frontend

A modern React-based frontend for the Database Query Execution Portal.

## Features

- **Query Submission Portal**: Submit SQL/MongoDB queries for approval
- **File Execution Portal**: Upload and execute Python/JavaScript scripts
- **Approval Dashboard**: Manager view to approve/reject pending requests
- **My Queries**: Track the status of submitted queries
- **Secrets Manager**: Browse and download AWS Secrets Manager secrets

## Tech Stack

- **React 18** - UI Framework
- **Vite** - Build Tool
- **Tailwind CSS** - Styling
- **React Router** - Client-side routing
- **Axios** - HTTP Client
- **Lucide React** - Icons
- **React Hot Toast** - Notifications
- **date-fns** - Date formatting

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your backend API URL:
```
VITE_API_URL=http://localhost:5000
```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # Reusable components
│   ├── common/         # Common UI components
│   └── layout/         # Layout components
├── context/            # React contexts
├── hooks/              # Custom hooks
├── pages/              # Page components
├── services/           # API services
└── utils/              # Utility functions
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:5000` |

## Deployment to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Set environment variables:
   - `VITE_API_URL`: Your Railway backend URL
4. Deploy

## API Endpoints

The frontend expects the following API endpoints:

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/profile` - Get profile
- `POST /api/auth/refresh` - Refresh token

### Queries
- `GET /api/queries/instances` - Get database instances
- `GET /api/queries/instances/:id/databases` - Get databases for instance
- `GET /api/queries/pods` - Get PODs
- `POST /api/queries/submit` - Submit query
- `POST /api/queries/submit-script` - Submit script
- `GET /api/queries/my-requests` - Get user's requests
- `GET /api/queries/pending` - Get pending requests (manager)
- `POST /api/queries/requests/:uuid/approve` - Approve request
- `POST /api/queries/requests/:uuid/reject` - Reject request

### Secrets
- `GET /api/secrets` - List secrets
- `GET /api/secrets/search` - Search secrets
- `GET /api/secrets/:name` - Get secret value

## License

MIT
