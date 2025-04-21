# Food Ordering Application

A full-stack food ordering and delivery application built with Node.js, Express, MongoDB, and EJS.

## Features

- User authentication and authorization
- Food item management
- Shopping cart functionality
- Order processing and tracking
- Admin dashboard

## Prerequisites

- Node.js (>=14.0.0)
- MongoDB (local or Atlas)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd food_project
```

2. Install dependencies:
```bash
npm install
```

3. Create environment variables:
```bash
cp .env.example .env
```
Edit the `.env` file with your configuration.

4. Start the development server:
```bash
npm run dev
```

## Production Deployment

1. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update the following variables:
     - `NODE_ENV=production`
     - `MONGODB_URL` (use your production MongoDB URL)
     - `SESSION_SECRET` (generate a strong random string)
     - `PORT` (set to your desired port)

2. Install production dependencies:
```bash
npm install --production
```

3. Start the production server:
```bash
npm start
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `MONGODB_URL`: MongoDB connection string
- `SESSION_SECRET`: Secret key for session encryption
- `NODE_ENV`: Environment mode (development/production)

## Security Considerations

- Always use HTTPS in production
- Keep your `.env` file secure and never commit it
- Use strong session secrets
- Regularly update dependencies
- Monitor application logs

## License

ISC 