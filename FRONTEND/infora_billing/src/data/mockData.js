// Mock data for the Infora WiFi Billing System

// Customer data
export const customers = [
  {
    id: 1,
    name: "John Doe",
    email: "john.doe@email.com",
    phone: "+254700123456",
    address: "123 Main St, Nairobi",
    status: "active",
    plan: "Premium WiFi",
    joinDate: "2024-01-15",
    lastPayment: "2024-03-01",
    balance: 0,
    dataUsage: "85%",
    deviceCount: 3
  },
  {
    id: 2,
    name: "Jane Smith",
    email: "jane.smith@email.com",
    phone: "+254700123457",
    address: "456 Oak Ave, Mombasa",
    status: "active",
    plan: "Standard WiFi",
    joinDate: "2024-02-01",
    lastPayment: "2024-03-15",
    balance: 2500,
    dataUsage: "45%",
    deviceCount: 2
  },
  {
    id: 3,
    name: "Mike Johnson",
    email: "mike.johnson@email.com",
    phone: "+254700123458",
    address: "789 Pine Rd, Kisumu",
    status: "inactive",
    plan: "Basic WiFi",
    joinDate: "2023-12-10",
    lastPayment: "2024-02-28",
    balance: 5000,
    dataUsage: "0%",
    deviceCount: 1
  },
  {
    id: 4,
    name: "Sarah Wilson",
    email: "sarah.wilson@email.com",
    phone: "+254700123459",
    address: "321 Elm St, Nakuru",
    status: "active",
    plan: "Premium WiFi",
    joinDate: "2024-01-20",
    lastPayment: "2024-03-10",
    balance: 0,
    dataUsage: "92%",
    deviceCount: 4
  },
  {
    id: 5,
    name: "David Brown",
    email: "david.brown@email.com",
    phone: "+254700123460",
    address: "654 Maple Dr, Eldoret",
    status: "suspended",
    plan: "Standard WiFi",
    joinDate: "2023-11-05",
    lastPayment: "2024-01-15",
    balance: 7500,
    dataUsage: "0%",
    deviceCount: 2
  }
];

// Payment data
export const payments = [
  {
    id: 1,
    customerId: 1,
    customerName: "John Doe",
    amount: 5000,
    method: "M-Pesa",
    status: "completed",
    date: "2024-03-01",
    reference: "MPESA123456"
  },
  {
    id: 2,
    customerId: 2,
    customerName: "Jane Smith",
    amount: 3500,
    method: "Bank Transfer",
    status: "completed",
    date: "2024-03-15",
    reference: "BANK789012"
  },
  {
    id: 3,
    customerId: 4,
    customerName: "Sarah Wilson",
    amount: 5000,
    method: "M-Pesa",
    status: "completed",
    date: "2024-03-10",
    reference: "MPESA345678"
  },
  {
    id: 4,
    customerId: 1,
    customerName: "John Doe",
    amount: 5000,
    method: "M-Pesa",
    status: "pending",
    date: "2024-04-01",
    reference: "MPESA901234"
  }
];

// Service plans data
export const servicePlans = [
  {
    id: 1,
    name: "Basic WiFi",
    description: "Essential internet for light usage",
    price: 2500,
    speed: "10 Mbps",
    dataLimit: "50 GB",
    features: ["Basic Support", "Email Support", "Standard Security"],
    status: "active",
    customerCount: 45
  },
  {
    id: 2,
    name: "Standard WiFi",
    description: "Reliable internet for regular usage",
    price: 3500,
    speed: "25 Mbps",
    dataLimit: "100 GB",
    features: ["Priority Support", "Phone Support", "Enhanced Security", "Parental Controls"],
    status: "active",
    customerCount: 78
  },
  {
    id: 3,
    name: "Premium WiFi",
    description: "High-speed internet for heavy usage",
    price: 5000,
    speed: "50 Mbps",
    dataLimit: "Unlimited",
    features: ["24/7 Support", "Premium Security", "Parental Controls", "VPN Access", "Cloud Storage"],
    status: "active",
    customerCount: 32
  },
  {
    id: 4,
    name: "Business WiFi",
    description: "Dedicated internet for business needs",
    price: 8000,
    speed: "100 Mbps",
    dataLimit: "Unlimited",
    features: ["Dedicated Support", "Business Security", "Static IP", "SLA Guarantee", "Advanced Analytics"],
    status: "active",
    customerCount: 12
  }
];

// Revenue data for charts
export const revenueData = [
  { month: "Jan", revenue: 450000 },
  { month: "Feb", revenue: 520000 },
  { month: "Mar", revenue: 480000 },
  { month: "Apr", revenue: 610000 },
  { month: "May", revenue: 550000 },
  { month: "Jun", revenue: 680000 },
  { month: "Jul", revenue: 720000 },
  { month: "Aug", revenue: 650000 },
  { month: "Sep", revenue: 590000 },
  { month: "Oct", revenue: 630000 },
  { month: "Nov", revenue: 710000 },
  { month: "Dec", revenue: 780000 }
];

// Package distribution data
export const packageDistribution = [
  { name: "Basic WiFi", value: 45, color: "#0088FE" },
  { name: "Standard WiFi", value: 78, color: "#00C49F" },
  { name: "Premium WiFi", value: 32, color: "#FFBB28" },
  { name: "Business WiFi", value: 12, color: "#FF8042" }
];

// Recent activity data
export const recentActivity = [
  {
    id: 1,
    type: "payment",
    message: "John Doe made a payment of KES 5,000",
    amount: 5000,
    timestamp: "2024-03-01T10:30:00Z"
  },
  {
    id: 2,
    type: "customer",
    message: "New customer Sarah Wilson registered",
    timestamp: "2024-03-01T09:15:00Z"
  },
  {
    id: 3,
    type: "payment",
    message: "Jane Smith made a payment of KES 3,500",
    amount: 3500,
    timestamp: "2024-02-28T14:45:00Z"
  },
  {
    id: 4,
    type: "alert",
    message: "Mike Johnson's service suspended due to non-payment",
    timestamp: "2024-02-28T11:20:00Z"
  },
  {
    id: 5,
    type: "payment",
    message: "Sarah Wilson made a payment of KES 5,000",
    amount: 5000,
    timestamp: "2024-02-27T16:30:00Z"
  }
];

// Invoice data
export const invoices = [
  {
    id: "INV-001",
    customerId: 1,
    customerName: "John Doe",
    amount: 5000,
    status: "paid",
    dueDate: "2024-03-01",
    issueDate: "2024-02-15",
    items: [
      { description: "Premium WiFi - March 2024", amount: 5000 }
    ]
  },
  {
    id: "INV-002",
    customerId: 2,
    customerName: "Jane Smith",
    amount: 3500,
    status: "paid",
    dueDate: "2024-03-15",
    issueDate: "2024-03-01",
    items: [
      { description: "Standard WiFi - March 2024", amount: 3500 }
    ]
  },
  {
    id: "INV-003",
    customerId: 3,
    customerName: "Mike Johnson",
    amount: 2500,
    status: "overdue",
    dueDate: "2024-02-28",
    issueDate: "2024-02-15",
    items: [
      { description: "Basic WiFi - February 2024", amount: 2500 }
    ]
  },
  {
    id: "INV-004",
    customerId: 4,
    customerName: "Sarah Wilson",
    amount: 5000,
    status: "paid",
    dueDate: "2024-03-10",
    issueDate: "2024-02-25",
    items: [
      { description: "Premium WiFi - March 2024", amount: 5000 }
    ]
  },
  {
    id: "INV-005",
    customerId: 5,
    customerName: "David Brown",
    amount: 3500,
    status: "overdue",
    dueDate: "2024-01-15",
    issueDate: "2024-01-01",
    items: [
      { description: "Standard WiFi - January 2024", amount: 3500 }
    ]
  }
];

// Mikrotik devices data
export const mikrotikDevices = [
  {
    id: 1,
    name: "Router-001",
    ipAddress: "192.168.1.1",
    location: "Nairobi Central",
    status: "online",
    model: "RB951G-2HnD",
    firmware: "6.49.7",
    uptime: "15 days, 8 hours",
    load: "15%",
    memory: "45%",
    connectedUsers: 25,
    bandwidth: "85 Mbps"
  },
  {
    id: 2,
    name: "Router-002",
    ipAddress: "192.168.1.2",
    location: "Mombasa Branch",
    status: "online",
    model: "RB951G-2HnD",
    firmware: "6.49.7",
    uptime: "8 days, 12 hours",
    load: "22%",
    memory: "60%",
    connectedUsers: 18,
    bandwidth: "65 Mbps"
  },
  {
    id: 3,
    name: "Router-003",
    ipAddress: "192.168.1.3",
    location: "Kisumu Office",
    status: "offline",
    model: "RB951G-2HnD",
    firmware: "6.49.7",
    uptime: "0 days, 0 hours",
    load: "0%",
    memory: "0%",
    connectedUsers: 0,
    bandwidth: "0 Mbps"
  },
  {
    id: 4,
    name: "Router-004",
    ipAddress: "192.168.1.4",
    location: "Nakuru Hub",
    status: "online",
    model: "RB951G-2HnD",
    firmware: "6.49.7",
    uptime: "12 days, 3 hours",
    load: "18%",
    memory: "52%",
    connectedUsers: 22,
    bandwidth: "78 Mbps"
  }
];

// Tickets data
export const tickets = [
  {
    id: 1,
    customerId: 1,
    customerName: "John Doe",
    subject: "Slow internet connection",
    description: "My internet has been very slow for the past 2 days. Speed test shows only 2 Mbps instead of 50 Mbps.",
    status: "open",
    priority: "medium",
    category: "Technical",
    assignedTo: "Support Team",
    createdAt: "2024-03-01T10:00:00Z",
    updatedAt: "2024-03-01T14:30:00Z"
  },
  {
    id: 2,
    customerId: 2,
    customerName: "Jane Smith",
    subject: "Billing inquiry",
    description: "I received an invoice for KES 5,000 but I should only be charged KES 3,500 for my Standard plan.",
    status: "in_progress",
    priority: "low",
    category: "Billing",
    assignedTo: "Billing Team",
    createdAt: "2024-02-28T09:15:00Z",
    updatedAt: "2024-03-01T11:45:00Z"
  },
  {
    id: 3,
    customerId: 4,
    customerName: "Sarah Wilson",
    subject: "Connection dropped",
    description: "My WiFi connection keeps dropping every few minutes. This started happening yesterday.",
    status: "resolved",
    priority: "high",
    category: "Technical",
    assignedTo: "Support Team",
    createdAt: "2024-02-27T16:20:00Z",
    updatedAt: "2024-02-28T10:30:00Z"
  },
  {
    id: 4,
    customerId: 5,
    customerName: "David Brown",
    subject: "Service reactivation",
    description: "I would like to reactivate my service. I have cleared my outstanding balance.",
    status: "open",
    priority: "medium",
    category: "Account",
    assignedTo: "Customer Service",
    createdAt: "2024-03-01T08:45:00Z",
    updatedAt: "2024-03-01T08:45:00Z"
  },
  {
    id: 5,
    customerId: 3,
    customerName: "Mike Johnson",
    subject: "Password reset",
    description: "I forgot my WiFi password and need help resetting it.",
    status: "resolved",
    priority: "low",
    category: "Account",
    assignedTo: "Support Team",
    createdAt: "2024-02-26T13:10:00Z",
    updatedAt: "2024-02-26T14:20:00Z"
  }
];
