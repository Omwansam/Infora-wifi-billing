# 🧪 Test Guide - Infora WiFi Billing System

## 🎯 Testing the Complete System with Sidebar Navigation

This guide will help you test the full system with sidebar navigation and dashboard charts.

---

## 🚀 Step 1: Test Basic Setup

### Run the Development Server
```bash
cd frontend/infora_billing
npm run dev
```

### Expected Result
- Server should start without errors
- You should see a message like: "Local: http://localhost:5173/"
- No red error messages in the terminal

---

## 🌐 Step 2: Test Complete Flow

### Open Browser
Navigate to: **http://localhost:5173**

### Expected Result - Step 1: Login Page
You should see:
- **Login Form** with email and password fields
- **"Sign In" button**
- **"Use Demo Credentials" button**
- Professional gradient background
- **Title**: "Infora WiFi Billing System"

### Expected Result - Step 2: After Login - Dashboard with Sidebar
After entering credentials and clicking "Sign In":
- **Sidebar appears** on the left with:
  - **Header**: "Infora WiFi" with "Billing System" subtitle
  - **Navigation menu** with all features
  - **User profile** at bottom with logout button
  - **System status** indicators
- **Dashboard content** on the right with:
  - **Header**: "Dashboard" with welcome message
  - **4 KPI Cards**: Total Revenue, Active Customers, Active Devices, Pending Invoices
  - **2 Charts**: Revenue Growth (line chart) and Package Distribution (pie chart)
  - **Recent Activity** feed
  - **Quick Actions** panel

---

## 🔐 Login Credentials

### Demo Credentials
- **Email**: `admin@infora.com`
- **Password**: `admin123`

### How to Login
1. **Option 1**: Enter credentials manually
2. **Option 2**: Click "Use Demo Credentials" button

---

## 🧭 Sidebar Navigation Features

### Navigation Menu Items
- **Dashboard** (Home icon)
- **Customer Management** (Users icon)
  - Add New Customer
  - View All Customers
  - KYC Management
- **Billing & Payments** (Credit Card icon)
  - Payments
  - Vouchers
  - Invoices
  - Transaction History
- **Service Plans** (Wifi icon)
- **Finance** (Trending Up icon)
  - Leads
  - Expenses
- **Communication** (Message Square icon)
  - SMS
  - Emails
  - Campaigns
- **Devices** (Server icon)
  - Mikrotik
  - Equipment
- **Tickets** (Ticket icon) - with badge "3"
- **Settings** (Settings icon)

### Sidebar Features
- **Collapsible sections** (click to expand/collapse)
- **Active page highlighting**
- **User profile** with avatar and logout button
- **System status** indicators (Online, Mikrotik Connected, RADIUS Active)
- **Mobile responsive** (hamburger menu on mobile)

---

## 📊 Dashboard Features

### KPI Cards
- **Total Revenue**: $15,420 (with 12.5% growth)
- **Active Customers**: 1,234 (with 8.2% growth)
- **Active Devices**: 89 (with -2.1% change)
- **Pending Invoices**: 23 (with -15.3% change)

### Charts
- **Revenue Growth**: Interactive line chart showing monthly revenue
- **Package Distribution**: Pie chart showing plan distribution

### Activity Feed
- **Recent activities** with icons and timestamps
- **Payment confirmations**
- **Customer registrations**
- **Ticket updates**

### Quick Actions
- **Add New Customer**
- **Process Payment**
- **Manage Devices**
- **Generate Report**

---

## ✅ Success Indicators

### ✅ Terminal Success
- No red error messages
- Server starts successfully
- Port 5173 is available

### ✅ Browser Success - Login Page
- Login form displays correctly
- Styling is applied (gradient background, form styling)
- No console errors (F12 → Console tab)

### ✅ Browser Success - Dashboard with Sidebar
- Sidebar loads with all navigation items
- Dashboard displays with charts and KPIs
- Charts are interactive and responsive
- Navigation between pages works
- Logout button in sidebar works
- No console errors

---

## 🔄 Complete Flow Test

### Test Complete Navigation
1. **Visit http://localhost:5173** → Login page appears
2. **Enter credentials** → admin@infora.com / admin123
3. **Click "Sign In"** → Dashboard with sidebar appears
4. **Test sidebar navigation** → Click different menu items
5. **Test charts** → Hover over charts to see tooltips
6. **Test logout** → Click logout in sidebar
7. **Verify redirect** → Returns to login page

### Test Responsive Design
- **Desktop**: Full sidebar visible
- **Tablet**: Collapsible sidebar
- **Mobile**: Hamburger menu

---

## 🚨 Troubleshooting

### If Terminal Shows Errors:
1. **Check Node.js version**: `node --version` (should be 16+)
2. **Clear cache**: `npm cache clean --force`
3. **Delete node_modules**: `rm -rf node_modules package-lock.json`
4. **Reinstall**: `npm install`

### If Login Page Doesn't Appear:
1. **Check console** (F12 → Console tab)
2. **Check network** (F12 → Network tab)
3. **Try different browser**
4. **Clear browser cache**

### If Sidebar Doesn't Load:
1. **Check if all components are imported correctly**
2. **Check console for import errors**
3. **Verify AppSidebar component exists**

### If Charts Don't Display:
1. **Check if Recharts is installed**
2. **Check console for chart errors**
3. **Verify mockData is loaded correctly**

### If Navigation Doesn't Work:
1. **Check if all page components exist**
2. **Check console for routing errors**
3. **Verify all imports are correct**

---

## 🎉 Next Steps

Once the complete system works correctly:

1. **Confirm sidebar navigation works**
2. **Verify all charts display correctly**
3. **Test all navigation links**
4. **Verify responsive design**
5. **System is ready for production use!**

---

## 📞 Report Results

Please report:
- ✅ **Success**: "Complete system works - sidebar navigation, charts, all features accessible"
- ❌ **Error**: "Error message here" + screenshot if possible

**This will help us confirm the complete system is working before final deployment!**
