export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number; // This will be the offer price
  mrp: number; // New: Manufacturer's Recommended Price
  discountPercentage: number; // New: Calculated discount percentage
  duration: string;
  optimizations: number;
  scoreChecks: number;
  linkedinMessages: number; // Changed from typeof Infinity to number
  guidedBuilds: number;
  tag: string;
  tagColor: string;
  gradient: string;
  icon: string;
  features: string[];
  popular?: boolean;
  durationInHours: number; // Added this property
}


export interface PaymentData {
  planId: string;
  amount: number;
  currency: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    name: string;
    email: string;
  };
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
}

export interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  startDate: string;
  endDate: string;
  optimizationsUsed: number;
  optimizationsTotal: number;
  paymentId: string | null;
  couponUsed: string | null;
  scoreChecksUsed: number;
  scoreChecksTotal: number;
  linkedinMessagesUsed: number;
  linkedinMessagesTotal: number;
  guidedBuildsUsed: number;
  guidedBuildsTotal: number;
}

