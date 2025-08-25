# Infora WiFi Billing - Authentication Setup Guide

This guide will help you set up the authentication system to work properly between the frontend and backend.

## Prerequisites

- Python 3.8+ (for backend)
- Node.js 16+ (for frontend)
- pipenv (for Python dependency management)

## Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Install Python dependencies:**
   ```bash
   pipenv install
   ```

3. **Activate the virtual environment:**
   ```bash
   pipenv shell
   ```

4. **Set up environment variables:**
   Create a `.env` file in the `backend/server/` directory with:
   ```env
   SECRET_KEY=your-secret-key-here
   JWT_SECRET_KEY=your-jwt-secret-key-here
   DATABASE_URL=sqlite:///infora_billing.db
   ```

5. **Initialize the database:**
   ```bash
   cd server
   flask db init
   flask db migrate
   flask db upgrade
   ```

6. **Seed the database with initial data:**
   ```bash
   python seed.py
   ```

7. **Start the backend server:**
   ```bash
   python app.py
   ```
   
   The backend will run on `http://localhost:5000`

## Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend/infora_billing
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   The frontend will run on `http://localhost:5173`

## Testing the Authentication

1. **Test API Connection:**
   - Go to the login page
   - Use the "Test Connection" button to verify backend connectivity

2. **Test Login:**
   - Use the demo credentials:
     - Email: `admin@infora.com`
     - Password: `admin123`
   - Or create a new account using the signup form

3. **Test Registration:**
   - Go to the signup page
   - Create a new account
   - You should be automatically logged in after successful registration

## Troubleshooting

### Common Issues

1. **CORS Errors:**
   - Ensure the backend is running on port 5000
   - Check that CORS is properly configured in `backend/server/app.py`

2. **Database Issues:**
   - Make sure you've run the database migrations
   - Check that the `.env` file has the correct database URL

3. **JWT Token Issues:**
   - Verify that `JWT_SECRET_KEY` is set in the backend `.env` file
   - Check that the frontend is using the correct API endpoints

4. **Network Errors:**
   - Ensure both frontend and backend are running
   - Check that the API base URL is correct in `frontend/infora_billing/src/config/api.js`

### Debug Mode

The frontend includes a connection test component on the login page that can help diagnose API connectivity issues.

## API Endpoints

The authentication system uses the following endpoints:

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/verify` - Verify token validity
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/change-password` - Change user password

## Security Features

- JWT-based authentication with access and refresh tokens
- Password hashing using Werkzeug
- CORS protection
- Token verification and refresh mechanisms
- Role-based access control (admin/support roles)

## File Structure

```
├── backend/
│   └── server/
│       ├── routes/
│       │   └── auth.py          # Authentication endpoints
│       ├── models.py            # User model
│       ├── app.py              # Flask application
│       └── config.py           # Configuration
└── frontend/
    └── infora_billing/
        └── src/
            ├── components/
            │   └── auth/
            │       ├── login.jsx
            │       ├── signup.jsx
            │       └── ConnectionTest.jsx
            ├── contexts/
            │   └── AuthContext.jsx
            ├── config/
            │   └── api.js
            └── utils/
                └── api.js
```
