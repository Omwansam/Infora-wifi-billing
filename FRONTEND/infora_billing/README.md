# 🚀 Infora WiFi Billing System

A modern, production-ready billing system dashboard built with React, TailwindCSS, and shadcn/ui.

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```

### 3. Open Your Browser
Navigate to: **http://localhost:5173**

### 4. Login
- **Email**: `admin@infora.com`
- **Password**: `admin123`

---

## 🔐 Authentication Flow

1. **First Visit** → Login page appears automatically
2. **Enter Credentials** → Use demo credentials above
3. **Click "Sign In"** → System validates and redirects to dashboard
4. **Dashboard with Sidebar** → Full navigation menu with all features
5. **Navigate** → Use sidebar to switch between pages
6. **Logout** → Returns to login page

---

## 🎯 What You'll See

### Login Page
- Professional login form with gradient background
- Demo credentials button for easy login
- Form validation and error handling

### Dashboard (After Login)
- **Sidebar Navigation**: Full menu with all features
- **Real-time KPIs**: Revenue, Active Users, Active Devices, Pending Invoices
- **Interactive Charts**: Revenue growth, Package distribution, Payment trends
- **Recent Activity Feed**: Live updates of system activities

### Full Feature Access
- **Customer Management**: List, add, search, filter customers
- **Billing & Payments**: Payments, invoices, transactions, vouchers
- **Service Plans**: Plan management with features
- **Device Management**: Mikrotik monitoring
- **Support Tickets**: Ticket system with priorities
- **Settings**: User preferences and configuration

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TailwindCSS 3, shadcn/ui
- **Routing**: React Router v6
- **Charts**: Recharts
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **State Management**: React Context API
- **Build Tool**: Vite
- **Notifications**: React Hot Toast

---

## 🚨 Troubleshooting

### If page is blank:
1. Check browser console (F12) for errors
2. Ensure all dependencies are installed
3. Try clearing browser cache

### If login fails:
- Use exact credentials: `admin@infora.com` / `admin123`
- Try the "Use Demo Credentials" button

### If dependencies are missing:
```bash
npm install react-hot-toast react-router-dom recharts framer-motion lucide-react
```

---

## 📊 Features

### 🏠 Dashboard
- Real-time KPIs and analytics
- Interactive charts and graphs
- Recent activity feed
- Professional layout with sidebar

### 👥 Customer Management
- Customer list with search and filtering
- Add new customers with comprehensive forms
- Customer details and status tracking
- KYC management (placeholder)

### 💰 Billing & Payments
- Payment processing and tracking
- Invoice management with download/send
- Transaction history with detailed records
- Voucher system with usage tracking

### 📦 Service Plans
- Plan management with feature lists
- Popular plan highlighting
- Plan selection and management

### 🔧 Device Management
- Mikrotik router monitoring
- Device status and uptime tracking
- Bandwidth analytics and usage patterns

### 🎫 Support System
- Ticket management with priority levels
- Status tracking (Open, Pending, Resolved)
- Assignment and response system

### ⚙️ Settings
- Profile management and preferences
- Security settings and 2FA options
- Theme settings (Dark/Light mode)
- System configuration

---

## 🎨 UI/UX Highlights

- **Professional Design**: Clean, modern interface
- **Sidebar Navigation**: Easy access to all features
- **Responsive Layout**: Works on all screen sizes
- **Smooth Animations**: Framer Motion transitions
- **Interactive Charts**: Recharts integration
- **Status Indicators**: Color-coded badges
- **Loading States**: Professional loading animations

---

## 🔧 Development

### Project Structure
```
src/
├── components/
│   ├── auth/
│   │   ├── login.jsx
│   │   ├── signup.jsx
│   │   └── AppSidebar.jsx
│   ├── customers/
│   ├── billing/
│   ├── plans/
│   ├── devices/
│   ├── tickets/
│   ├── settings/
│   ├── placeholder/
│   └── Dashboard.jsx
├── contexts/
│   └── AuthContext.jsx
├── data/
│   └── mockData.js
├── lib/
│   └── utils.js
├── App.jsx
├── main.jsx
└── index.css
```

### Key Components
- **AuthContext**: Authentication state management
- **AppSidebar**: Navigation sidebar with all features
- **Dashboard**: Main dashboard with KPIs and charts
- **ProtectedRoute**: Route protection component

---

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

---

## 📝 License

This project is licensed under the MIT License.

---

**🎉 The Infora WiFi Billing System is ready to use!**

**Just run `npm run dev` and login to see the complete system with sidebar navigation!**
