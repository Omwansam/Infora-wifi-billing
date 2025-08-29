# Infora WiFi Billing System

A comprehensive WiFi billing and network management system built with Flask (Python) backend and React (JavaScript) frontend. This system provides complete billing, customer management, and network infrastructure management for WiFi service providers.

## 🌟 Features

### Core Billing Features
- **Customer Management**: Complete customer profiles, billing history, and account management
- **Service Plans**: Flexible pricing plans with different speeds and billing cycles
- **Invoice Generation**: Automated invoice creation and management
- **Payment Processing**: Integration with M-Pesa for mobile payments (Kenya)
- **Voucher System**: Prepaid vouchers and promotional codes
- **Billing Cycles**: Support for monthly, quarterly, and annual billing

### Network Management
- **Mikrotik Integration**: Direct management of Mikrotik routers
- **FreeRADIUS**: Authentication and accounting for WiFi users
- **LDAP Integration**: Centralized user authentication
- **SNMP Monitoring**: Network device monitoring and management
- **VPN Management**: WireGuard VPN configuration and management
- **EAP Profiles**: Enterprise WiFi authentication profiles

### Administrative Features
- **Multi-role Access**: Admin, support, and billing team roles
- **Dashboard Analytics**: Revenue tracking and customer insights
- **Support Tickets**: Customer support ticket system
- **System Logs**: Comprehensive audit trails
- **Backup Management**: Automated database backups
- **Email/SMS Integration**: Customer communication tools

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Flask Backend  │    │   PostgreSQL    │
│   (Port 5173)   │◄──►│   (Port 5000)   │◄──►│   (Port 5432)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   FreeRADIUS    │
                       │   (Port 1812)   │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   OpenLDAP      │
                       │   (Port 389)    │
                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (Recommended)
- **Python 3.8+** (for local development)
- **Node.js 16+** (for local frontend development)
- **PostgreSQL 13+** (for local database)

### Option 1: Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/infora-wifi-billing.git
   cd infora-wifi-billing
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start all services**
   ```bash
   docker-compose up -d
   ```

4. **Initialize the database**
   ```bash
   docker-compose exec flask_app flask db upgrade
   docker-compose exec flask_app flask initdb
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - LDAP Admin: http://localhost:8080

### Option 2: Local Development Setup

#### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install Python dependencies**
   ```bash
   pip install pipenv
   pipenv install
   pipenv shell
   ```

3. **Set up environment variables**
   ```bash
   export FLASK_APP=server/app.py
   export FLASK_ENV=development
   export DATABASE_URL=postgresql://username:password@localhost/infora_billing
   export JWT_SECRET_KEY=your-secret-key
   ```

4. **Initialize database**
   ```bash
   flask db upgrade
   flask initdb
   ```

5. **Run the backend**
   ```bash
   python server/app.py
   ```

#### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend/infora_billing
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://infora_user:infora_password@localhost/infora_billing

# JWT
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production

# RADIUS
RADIUS_SECRET=radius_secret_key

# LDAP
LDAP_BIND_PASSWORD=admin_password

# M-Pesa (Kenya Mobile Money)
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_ENVIRONMENT=sandbox

# Email
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_DEFAULT_SENDER=your_email@gmail.com
```

### Default Login Credentials

After running the seed script, you can login with:

- **Admin**: `admin1@infora.com` / `admin123`
- **Super Admin**: `superadmin@infora.com` / `superadmin123`
- **Support**: `support@infora.com` / `support123`
- **Billing**: `billing@infora.com` / `billing123`

## 📁 Project Structure

```
infora-wifi-billing/
├── backend/                    # Flask backend
│   ├── server/
│   │   ├── app.py             # Main Flask application
│   │   ├── config.py          # Configuration settings
│   │   ├── models.py          # Database models
│   │   ├── seed.py            # Database seeder
│   │   └── routes/            # API routes
│   │       ├── auth.py        # Authentication routes
│   │       ├── billing.py     # Billing routes
│   │       ├── customers.py   # Customer management
│   │       ├── invoices.py    # Invoice management
│   │       └── ...
│   ├── Dockerfile
│   └── Pipfile
├── frontend/                   # React frontend
│   └── infora_billing/
│       ├── src/
│       │   ├── components/    # React components
│       │   ├── services/      # API services
│       │   └── contexts/      # React contexts
│       ├── package.json
│       └── vite.config.js
├── config/                     # Configuration files
│   ├── freeradius/            # FreeRADIUS config
│   └── ldap/                  # LDAP configuration
└── docker-compose.yml         # Docker orchestration
```

## 🛠️ Development

### Adding New Features

1. **Backend API Routes**
   - Add new routes in `backend/server/routes/`
   - Update models in `backend/server/models.py`
   - Run database migrations: `flask db migrate -m "Description"`

2. **Frontend Components**
   - Create components in `frontend/infora_billing/src/components/`
   - Add API services in `frontend/infora_billing/src/services/`
   - Update routing in main App component

### Database Migrations

```bash
# Create a new migration
flask db migrate -m "Add new table"

# Apply migrations
flask db upgrade

# Rollback migration
flask db downgrade
```

### Testing

```bash
# Backend tests
cd backend
pipenv run python -m pytest

# Frontend tests
cd frontend/infora_billing
npm test
```

## 🔌 API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

### Customer Management

- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `GET /api/customers/<id>` - Get customer details
- `PUT /api/customers/<id>` - Update customer
- `DELETE /api/customers/<id>` - Delete customer

### Billing Endpoints

- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/plans` - List service plans
- `POST /api/payments` - Process payment

## 🚀 Deployment

### Production Deployment

1. **Update environment variables for production**
2. **Set up SSL certificates**
3. **Configure reverse proxy (Nginx)**
4. **Set up database backups**
5. **Configure monitoring and logging**

### Docker Production Build

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

### Code Style

- **Backend**: Follow PEP 8 Python style guide
- **Frontend**: Use ESLint and Prettier for code formatting
- **Database**: Use descriptive table and column names

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed documentation
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions and ideas

## 🗺️ Roadmap

- [ ] Mobile app for customer self-service
- [ ] Advanced analytics and reporting
- [ ] Multi-tenant support
- [ ] API rate limiting
- [ ] Webhook integrations
- [ ] Advanced network monitoring
- [ ] Customer portal enhancements

## 🙏 Acknowledgments

- Flask community for the excellent web framework
- React team for the frontend library
- FreeRADIUS project for authentication
- OpenLDAP project for directory services

---

**Note**: This is a development version. For production use, ensure all security configurations are properly set up and tested.
