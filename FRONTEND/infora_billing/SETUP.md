# 🚀 Setup Guide - Infora WiFi Billing System

## Quick Fix Steps

### 1. Install Missing Dependencies
```bash
npm install react-hot-toast react-router-dom recharts framer-motion lucide-react
```

### 2. Start the Development Server
```bash
npm run dev
```

### 3. Open Your Browser
Navigate to: **http://localhost:5173**

### 4. Login with Demo Credentials
- **Email**: `admin@infora.com`
- **Password**: `admin123`

---

## 🔧 If You Encounter Issues

### Issue: "Failed to resolve import"
**Solution**: Run the install command above

### Issue: "crypto.hash is not a function"
**Solution**: 
1. Delete node_modules: `rm -rf node_modules package-lock.json`
2. Reinstall: `npm install`

### Issue: Port already in use
**Solution**: 
1. Kill the process: `npx kill-port 5173`
2. Restart: `npm run dev`

---

## 📱 What You'll See

### 1. Login Page (First Screen)
- Professional login form
- Demo credentials option
- Sign up link

### 2. Dashboard (After Login)
- Real-time KPIs
- Interactive charts
- Recent activity feed

### 3. Full Navigation
- Customer Management
- Billing & Payments
- Service Plans
- Device Management
- Support Tickets
- Settings

---

## 🎯 Authentication Flow

1. **First Visit**: Redirected to `/login`
2. **Enter Credentials**: Use demo credentials
3. **Success**: Redirected to dashboard
4. **Protected Routes**: All features require login
5. **Logout**: Returns to login page

---

## 🚨 Troubleshooting

### If npm install fails:
```bash
npm cache clean --force
npm install --legacy-peer-deps
```

### If the app doesn't start:
```bash
node --version  # Should be 16+
npm --version   # Should be 8+
```

### If you see blank screen:
1. Check browser console (F12)
2. Look for import errors
3. Run the install command again

---

## 📞 Need Help?

1. Check the browser console for errors
2. Verify all dependencies are installed
3. Ensure you're in the correct directory
4. Try clearing browser cache

---

**🎉 Once running, you'll have access to the complete billing system!**
