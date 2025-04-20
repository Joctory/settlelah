# SettleLah

A node.js web app that can split your bill wisely!

## Authentication Setup

SettleLah now includes a secure 6-digit passcode login system. To configure authentication:

### In Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to **Settings** > **Environment Variables**
3. Add the following environment variables:
   - `APP_PASSCODE`: Your 6-digit numeric passcode (e.g., "123456")
   - `SETTLELAH_AUTH_TOKEN`: A random secure string for API authentication (e.g., generate one at https://randomkeygen.com/)

### Local Development

For local development, you can add these variables to your `.env` file:

```
APP_PASSCODE=123456
SETTLELAH_AUTH_TOKEN=your_random_secure_string
```

## Authentication Features

- Secure 6-digit passcode entry screen
- Passcode validation against environment variable
- Session-based authentication (24-hour validity)
- Protected routes requiring authentication
- Logout functionality in settings
- Public result sharing (no authentication required)

## Usage

1. Deploy your app to Vercel
2. Set up the environment variables
3. Access the app - you'll be prompted for the passcode
4. Enter the configured passcode to access the app
