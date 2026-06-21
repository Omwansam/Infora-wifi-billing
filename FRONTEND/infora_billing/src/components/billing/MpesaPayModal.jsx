import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/utils';
import paymentService from '../../services/paymentService';

const STEPS = {
  FORM: 'form',
  SENDING: 'sending',
  WAITING: 'waiting',
  SUCCESS: 'success',
  ERROR: 'error',
};

export default function MpesaPayModal({
  open,
  onClose,
  customerId,
  invoiceId = null,
  amount,
  customerName = '',
  invoiceLabel = '',
  defaultPhone = '',
  onSuccess,
}) {
  const [phone, setPhone] = useState(defaultPhone || '');
  const [step, setStep] = useState(STEPS.FORM);
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState('');

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone || '');
      setStep(STEPS.FORM);
      setMessage('');
      setReceipt('');
    }
  }, [open, defaultPhone]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerId) {
      toast.error('Customer is required for M-Pesa payment');
      return;
    }
    if (!phone.trim()) {
      toast.error('Enter the M-Pesa phone number');
      return;
    }

    setStep(STEPS.SENDING);
    setMessage('Sending STK push to phone…');

    const stk = await paymentService.initiateMpesaStkPush({
      customerId,
      invoiceId,
      phone: phone.trim(),
      amount,
    });

    if (!stk.success) {
      setStep(STEPS.ERROR);
      setMessage(stk.error || 'Could not start M-Pesa payment');
      return;
    }

    const checkoutId = stk.data?.checkout_request_id;
    if (!checkoutId) {
      setStep(STEPS.ERROR);
      setMessage('Missing checkout reference from server');
      return;
    }

    setStep(STEPS.WAITING);
    setMessage(stk.data?.customer_request_id || 'Check your phone and enter M-Pesa PIN…');

    const poll = await paymentService.pollMpesaPaymentStatus(checkoutId);

    if (poll.success) {
      setStep(STEPS.SUCCESS);
      setReceipt(poll.data?.receipt || '');
      setMessage('Payment received. Customer access has been activated.');
      toast.success('M-Pesa payment completed');
      onSuccess?.(poll.data);
      return;
    }

    if (poll.pending) {
      setStep(STEPS.WAITING);
      setMessage(poll.error);
      toast('Payment still pending — check Payments for updates', { icon: '⏳' });
      onClose?.();
      return;
    }

    setStep(STEPS.ERROR);
    setMessage(poll.error || 'Payment failed');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
      >
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-emerald-100 text-xs uppercase tracking-wider">Pay with M-Pesa</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(amount)}</p>
              {customerName && <p className="text-emerald-100 text-sm mt-1">{customerName}</p>}
              {invoiceLabel && <p className="text-emerald-100/80 text-xs mt-0.5 font-mono">{invoiceLabel}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={step === STEPS.SENDING || step === STEPS.WAITING}
              className="text-white/80 hover:text-white disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {step === STEPS.FORM && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-600">
                Enter the Safaricom number to receive the STK push. On success, the invoice is marked paid and WiFi access is provisioned via RADIUS.
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">M-Pesa phone number</label>
                <div className="relative">
                  <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0712345678 or 254712345678"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    autoFocus
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-sm"
              >
                Send STK push
              </button>
            </form>
          )}

          {(step === STEPS.SENDING || step === STEPS.WAITING) && (
            <div className="text-center py-6">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto mb-4" />
              <p className="font-medium text-slate-900">{step === STEPS.SENDING ? 'Connecting to M-Pesa…' : 'Waiting for confirmation…'}</p>
              <p className="text-sm text-slate-500 mt-2">{message}</p>
            </div>
          )}

          {step === STEPS.SUCCESS && (
            <div className="text-center py-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
              <p className="font-semibold text-slate-900">Payment successful</p>
              {receipt && <p className="text-sm font-mono text-slate-600 mt-1">Receipt: {receipt}</p>}
              <p className="text-sm text-slate-500 mt-2">{message}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-6 w-full py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
              >
                Done
              </button>
            </div>
          )}

          {step === STEPS.ERROR && (
            <div className="text-center py-4">
              <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
              <p className="font-semibold text-slate-900">Payment could not be completed</p>
              <p className="text-sm text-slate-500 mt-2">{message}</p>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => setStep(STEPS.FORM)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
