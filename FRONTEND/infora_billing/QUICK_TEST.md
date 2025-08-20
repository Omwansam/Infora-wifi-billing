# 🚀 Quick Test - Basic Working Version

## 🎯 Testing the Basic System

This is a simplified version to ensure the system displays in the browser.

---

## 🚀 Step 1: Test Basic Setup

### Run the Development Server
```bash
cd frontend/infora_billing
npm run dev
```

### Expected Result
- Server should start without errors
- You should see: "Local: http://localhost:5173/"
- No red error messages in terminal

---

## 🌐 Step 2: Test Browser Display

### Open Browser
Navigate to: **http://localhost:5173**

### Expected Result - Step 1: Login Page
You should see:
- **Login Form** with email and password fields
- **"Sign In" button**
- **"Use Demo Credentials" button**
- Professional gradient background
- **Title**: "Infora WiFi Billing System"

### Expected Result - Step 2: After Login
After entering credentials and clicking "Sign In":
- **Dashboard appears** with:
  - **Header**: "Dashboard" with logout button
  - **4 KPI Cards**: Revenue, Active Users, Active Devices, Pending Invoices
  - **Welcome message**: "You have successfully logged in!"

---

## 🔐 Login Credentials

### Demo Credentials
- **Email**: `admin@infora.com`
- **Password**: `admin123`

### How to Login
1. **Option 1**: Enter credentials manually
2. **Option 2**: Click "Use Demo Credentials" button

---

## ✅ Success Indicators

### ✅ Terminal Success
- No red error messages
- Server starts successfully
- Port 5173 is available

### ✅ Browser Success
- Login page displays correctly
- Dashboard loads after login
- Logout button works
- No console errors (F12 → Console tab)

---

## 🚨 Troubleshooting

### If Terminal Shows Errors:
1. **Check Node.js version**: `node --version` (should be 16+)
2. **Clear cache**: `npm cache clean --force`
3. **Delete node_modules**: `rm -rf node_modules package-lock.json`
4. **Reinstall**: `npm install`

### If Browser Shows Blank Page:
1. **Check console** (F12 → Console tab)
2. **Check network** (F12 → Network tab)
3. **Try different browser**
4. **Clear browser cache**

### If Login Fails:
- Use exact credentials: `admin@infora.com` / `admin123`
- Try the "Use Demo Credentials" button

---

## 📞 Report Results

Please report:
- ✅ **Success**: "Basic system works - login page → dashboard"
- ❌ **Error**: "Error message here" + screenshot if possible

**Once this basic version works, we'll add the sidebar and full features!**
