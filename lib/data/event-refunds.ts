/**
 * Event Refunds Data
 * 
 * This file contains refunds received from events.
 * These are refunds of unused or returned event funds, NOT loan refunds.
 * 
 * Last updated: Based on user-provided refund list
 */

import { Transaction } from '@/lib/types';

export interface EventRefund {
  date: string; // Date in format that can be parsed by parseDate
  amount: number; // Amount in HBD
  sender: string; // Account that sent the refund
  description: string; // Description/memo of the refund
  year: number; // Year for filtering
}

/**
 * Event refunds received from various events
 * Format: Date, Amount (HBD), Sender, Description
 * 
 * Note: The first refund is marked as "18 days ago" - using approximate date of Dec 17, 2025
 */
export const EVENT_REFUNDS: EventRefund[] = [
  {
    date: '17/12/2025', // Approximately 18 days ago from when data was provided
    amount: 500.000,
    sender: 'hiverun',
    description: 'Refund for the Caracas Rock Photography Contest was not made.',
    year: 2025,
  },
  {
    date: '27/10/2025',
    amount: 2600.000,
    sender: 'coldone',
    description: 'Vibes | global | refund.',
    year: 2025,
  },
  {
    date: '20/09/2025',
    amount: 551.000,
    sender: 'guiltyparties',
    description: 'CLF | Colombia | refund due to compromised user account | loss refund',
    year: 2025,
  },
  {
    date: '06/09/2025',
    amount: 551.250,
    sender: 'ecoinstant',
    description: 'refund ecoinstante.',
    year: 2025,
  },
  {
    date: '02/09/2025',
    amount: 560.000,
    sender: 'hivecuba',
    description: 'HiveCubaCon physical event canceled - 1060 HBD can\'t be returned do to having been invested',
    year: 2025,
  },
  {
    date: '27/08/2025',
    amount: 147.500,
    sender: 'latamwallet',
    description: 'Refund of event funds CES La Paz, CES Santa Cruz, PBS Asunción and CLF Medellín.',
    year: 2025,
  },
  {
    date: '25/08/2025',
    amount: 140.700,
    sender: 'danielvehe',
    description: 'Refund of "Hive Goes to School" - Distriator Workshop was only partially completed,',
    year: 2025,
  },
  {
    date: '14/08/2025',
    amount: 210.000,
    sender: 'latamwallet',
    description: 'Return of funds by @jthomasewsky.',
    year: 2025,
  },
  {
    date: '02/08/2025',
    amount: 661.500,
    sender: 'latamwallet',
    description: 'Refund of part of the budget because it was sent first @jthomasewsky | Tx: 865642b2fe60bdfe4ad35edc51bfd9ba06441378.',
    year: 2025,
  },
  {
    date: '25/06/2025',
    amount: 4.294,
    sender: 'bigfluffyclouds',
    description: '',
    year: 2025,
  },
  {
    date: '24/06/2025',
    amount: 5.000,
    sender: 'hivecuba',
    description: 'unused funds for fee after using Hive P2P.',
    year: 2025,
  },
  {
    date: '16/05/2025',
    amount: 2701.570,
    sender: 'buzzparty',
    description: 'Remaining funds of the Hive Creator Days in Graz - Thank you for your support & trust!',
    year: 2025,
  },
  {
    date: '10/05/2025',
    amount: 137.000,
    sender: 'talentlandfund',
    description: 'Funds Returned from event savings.',
    year: 2025,
  },
  {
    date: '01/05/2025',
    amount: 3479.070,
    sender: 'talentlandfund',
    description: 'Unspent Talent Land Budget Due to Savings During Event Execution.',
    year: 2025,
  },
  {
    date: '02/04/2025',
    amount: 40.000,
    sender: 'arlettemsalase',
    description: 'Refund of unused prizes at Cumbres de Comunidades 2025.',
    year: 2025,
  },
  {
    date: '12/03/2025',
    amount: 120.000,
    sender: 'buzzparty',
    description: 'excess is going back to you - thank you for the support!',
    year: 2025,
  },
  {
    date: '04/03/2025',
    amount: 180.000,
    sender: 'arlettemsalase',
    description: 'Return of funds from @ jthomasewsky at the end of his trip on 2/3/2025 | Modular Carnival | Belo Horizonte, Brazil.',
    year: 2025,
  },
  {
    date: '04/03/2025',
    amount: 100.000,
    sender: 'arlettemsalase',
    description: 'Extra money planned for @xvlad who was unable to attend due to illness | Modular Carnival | Belo Horizonte, Brazil.',
    year: 2025,
  },
  {
    date: '04/03/2025',
    amount: 330.750,
    sender: 'arlettemsalase',
    description: 'Expenses of @xvlad that he used because he did not attend due to illness | Modular Carnival | Belo Horizonte, Brazil.',
    year: 2025,
  },
  {
    date: '19/02/2025',
    amount: 200.000,
    sender: 'hivecreators',
    description: 'Return https://hivehub.dev/tx/18350b5a04e602344bdb5c1bc7be8e7558ec2779',
    year: 2025,
  },
  {
    date: '31/01/2025',
    amount: 1250.000,
    sender: 'blackheart',
    description: 'To be given later',
    year: 2025,
  },
];

/**
 * Calculate total refunds for a given year
 */
export function getTotalEventRefunds(year?: number): number {
  const refunds = year 
    ? EVENT_REFUNDS.filter(r => r.year === year)
    : EVENT_REFUNDS;
  return refunds.reduce((sum, refund) => sum + refund.amount, 0);
}

/**
 * Get event refunds as Transaction objects for integration with existing system
 */
export function getEventRefundsAsTransactions(): Transaction[] {
  return EVENT_REFUNDS.map(refund => ({
    wallet: refund.sender,
    date: refund.date,
    hbd: refund.amount,
    hive: 0,
    eventProject: '',
    country: '',
    theme: '',
    eventType: '',
    category: 'Event Refund',
    isRefund: true,
    isLoan: false,
    isLoanRefund: false,
    totalSpend: refund.amount,
  }));
}

