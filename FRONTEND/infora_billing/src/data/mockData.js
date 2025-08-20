export const customers = [
  {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '+1 (555) 123-4567',
    address: '123 Main St, City, State 12345',
    plan: 'Premium 100Mbps',
    status: 'active',
    joinDate: '2024-01-15',
    lastPayment: '2024-03-01',
    balance: 0,
    usage: '85%',
    deviceCount: 3
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    email: 'sarah.j@email.com',
    phone: '+1 (555) 234-5678',
    address: '456 Oak Ave, City, State 12345',
    plan: 'Basic 50Mbps',
    status: 'active',
    joinDate: '2024-02-10',
    lastPayment: '2024-03-05',
    balance: 29.99,
    usage: '45%',
    deviceCount: 2
  },
  {
    id: '3',
    name: 'Mike Wilson',
    email: 'mike.w@email.com',
    phone: '+1 (555) 345-6789',
    address: '789 Pine Rd, City, State 12345',
    plan: 'Premium 100Mbps',
    status: 'suspended',
    joinDate: '2023-11-20',
    lastPayment: '2024-02-15',
    balance: 89.97,
    usage: '0%',
    deviceCount: 0
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily.d@email.com',
    phone: '+1 (555) 456-7890',
    address: '321 Elm St, City, State 12345',
    plan: 'Business 200Mbps',
    status: 'active',
    joinDate: '2023-09-05',
    lastPayment: '2024-03-10',
    balance: 0,
    usage: '92%',
    deviceCount: 8
  },
  {
    id: '5',
    name: 'David Brown',
    email: 'david.b@email.com',
    phone: '+1 (555) 567-8901',
    address: '654 Maple Dr, City, State 12345',
    plan: 'Basic 50Mbps',
    status: 'active',
    joinDate: '2024-01-30',
    lastPayment: '2024-03-08',
    balance: 0,
    usage: '30%',
    deviceCount: 1
  }
]

export const invoices = [
  {
    id: 'INV-001',
    customerId: '1',
    customerName: 'John Smith',
    amount: 79.99,
    status: 'paid',
    dueDate: '2024-03-01',
    paidDate: '2024-03-01',
    items: [
      { description: 'Premium 100Mbps Plan', amount: 79.99 }
    ]
  },
  {
    id: 'INV-002',
    customerId: '2',
    customerName: 'Sarah Johnson',
    amount: 49.99,
    status: 'paid',
    dueDate: '2024-03-05',
    paidDate: '2024-03-05',
    items: [
      { description: 'Basic 50Mbps Plan', amount: 49.99 }
    ]
  },
  {
    id: 'INV-003',
    customerId: '3',
    customerName: 'Mike Wilson',
    amount: 79.99,
    status: 'overdue',
    dueDate: '2024-02-15',
    paidDate: null,
    items: [
      { description: 'Premium 100Mbps Plan', amount: 79.99 }
    ]
  },
  {
    id: 'INV-004',
    customerId: '4',
    customerName: 'Emily Davis',
    amount: 149.99,
    status: 'paid',
    dueDate: '2024-03-10',
    paidDate: '2024-03-10',
    items: [
      { description: 'Business 200Mbps Plan', amount: 149.99 }
    ]
  },
  {
    id: 'INV-005',
    customerId: '5',
    customerName: 'David Brown',
    amount: 49.99,
    status: 'paid',
    dueDate: '2024-03-08',
    paidDate: '2024-03-08',
    items: [
      { description: 'Basic 50Mbps Plan', amount: 49.99 }
    ]
  }
]

export const payments = [
  {
    id: 'PAY-001',
    invoiceId: 'INV-001',
    customerName: 'John Smith',
    amount: 79.99,
    method: 'credit_card',
    status: 'completed',
    date: '2024-03-01'
  },
  {
    id: 'PAY-002',
    invoiceId: 'INV-002',
    customerName: 'Sarah Johnson',
    amount: 49.99,
    method: 'bank_transfer',
    status: 'completed',
    date: '2024-03-05'
  },
  {
    id: 'PAY-003',
    invoiceId: 'INV-004',
    customerName: 'Emily Davis',
    amount: 149.99,
    method: 'credit_card',
    status: 'completed',
    date: '2024-03-10'
  },
  {
    id: 'PAY-004',
    invoiceId: 'INV-005',
    customerName: 'David Brown',
    amount: 49.99,
    method: 'paypal',
    status: 'completed',
    date: '2024-03-08'
  }
]

export const servicePlans = [
  {
    id: '1',
    name: 'Basic 50Mbps',
    speed: '50 Mbps',
    price: 49.99,
    features: ['50 Mbps Download', '10 Mbps Upload', '1 Device', 'Basic Support'],
    popular: false
  },
  {
    id: '2',
    name: 'Premium 100Mbps',
    speed: '100 Mbps',
    price: 79.99,
    features: ['100 Mbps Download', '20 Mbps Upload', '5 Devices', 'Priority Support'],
    popular: true
  },
  {
    id: '3',
    name: 'Business 200Mbps',
    speed: '200 Mbps',
    price: 149.99,
    features: ['200 Mbps Download', '50 Mbps Upload', 'Unlimited Devices', '24/7 Support'],
    popular: false
  }
]

export const mikrotikDevices = [
  {
    id: '1',
    name: 'Router-01',
    ip: '192.168.1.1',
    model: 'RB4011iGS+',
    status: 'online',
    uptime: '15 days',
    clients: 45,
    bandwidth: '85%'
  },
  {
    id: '2',
    name: 'Router-02',
    ip: '192.168.1.2',
    model: 'hAP ac²',
    status: 'online',
    uptime: '8 days',
    clients: 23,
    bandwidth: '60%'
  },
  {
    id: '3',
    name: 'Router-03',
    ip: '192.168.1.3',
    model: 'RB450Gx4',
    status: 'offline',
    uptime: '0 days',
    clients: 0,
    bandwidth: '0%'
  }
]

export const tickets = [
  {
    id: 'TICKET-001',
    customerName: 'John Smith',
    subject: 'Slow internet connection',
    status: 'open',
    priority: 'medium',
    assignedTo: 'Support Team',
    createdAt: '2024-03-15',
    lastUpdated: '2024-03-15'
  },
  {
    id: 'TICKET-002',
    customerName: 'Sarah Johnson',
    subject: 'Billing inquiry',
    status: 'resolved',
    priority: 'low',
    assignedTo: 'Billing Team',
    createdAt: '2024-03-10',
    lastUpdated: '2024-03-12'
  },
  {
    id: 'TICKET-003',
    customerName: 'Mike Wilson',
    subject: 'Service restoration request',
    status: 'pending',
    priority: 'high',
    assignedTo: 'Technical Team',
    createdAt: '2024-03-14',
    lastUpdated: '2024-03-14'
  }
]

export const revenueData = [
  { month: 'Jan', revenue: 12500 },
  { month: 'Feb', revenue: 13800 },
  { month: 'Mar', revenue: 15200 },
  { month: 'Apr', revenue: 14100 },
  { month: 'May', revenue: 16800 },
  { month: 'Jun', revenue: 17500 }
]

export const packageDistribution = [
  { name: 'Basic 50Mbps', value: 35, color: '#3B82F6' },
  { name: 'Premium 100Mbps', value: 45, color: '#10B981' },
  { name: 'Business 200Mbps', value: 20, color: '#F59E0B' }
]

export const recentActivity = [
  {
    id: '1',
    type: 'payment',
    message: 'Payment received from John Smith',
    amount: 79.99,
    timestamp: '2024-03-15T10:30:00Z'
  },
  {
    id: '2',
    type: 'customer',
    message: 'New customer registration: David Brown',
    timestamp: '2024-03-15T09:15:00Z'
  },
  {
    id: '3',
    type: 'ticket',
    message: 'Support ticket opened by Sarah Johnson',
    timestamp: '2024-03-15T08:45:00Z'
  },
  {
    id: '4',
    type: 'device',
    message: 'Router-02 went offline',
    timestamp: '2024-03-15T07:20:00Z'
  },
  {
    id: '5',
    type: 'payment',
    message: 'Payment received from Emily Davis',
    amount: 149.99,
    timestamp: '2024-03-15T06:10:00Z'
  }
]
