# Event Refunds Summary

This document summarizes the event refunds that have been captured and stored in the system.

**Date Captured:** December 2025  
**Total Refunds:** 21 transactions  
**Total Amount:** 14,469.634 HBD

---

## Refunds by Date

| Date | Amount (HBD) | Sender | Description |
|------|--------------|--------|-------------|
| 2025-12-17 | 500.000 | hiverun | Refund for the Caracas Rock Photography Contest was not made. |
| 2025-10-27 | 2,600.000 | coldone | Vibes \| global \| refund. |
| 2025-09-20 | 551.000 | guiltyparties | CLF \| Colombia \| refund due to compromised user account \| loss refund |
| 2025-09-06 | 551.250 | ecoinstant | refund ecoinstante. |
| 2025-09-02 | 560.000 | hivecuba | HiveCubaCon physical event canceled - 1060 HBD can't be returned do to having been invested |
| 2025-08-27 | 147.500 | latamwallet | Refund of event funds CES La Paz, CES Santa Cruz, PBS Asunción and CLF Medellín. |
| 2025-08-25 | 140.700 | danielvehe | Refund of "Hive Goes to School" - Distriator Workshop was only partially completed, |
| 2025-08-14 | 210.000 | latamwallet | Return of funds by @jthomasewsky. |
| 2025-08-02 | 661.500 | latamwallet | Refund of part of the budget because it was sent first @jthomasewsky \| Tx: 865642b2fe60bdfe4ad35edc51bfd9ba06441378. |
| 2025-06-25 | 4.294 | bigfluffyclouds | |
| 2025-06-24 | 5.000 | hivecuba | unused funds for fee after using Hive P2P. |
| 2025-05-16 | 2,701.570 | buzzparty | Remaining funds of the Hive Creator Days in Graz - Thank you for your support & trust! |
| 2025-05-10 | 137.000 | talentlandfund | Funds Returned from event savings. |
| 2025-05-01 | 3,479.070 | talentlandfund | Unspent Talent Land Budget Due to Savings During Event Execution. |
| 2025-04-02 | 40.000 | arlettemsalase | Refund of unused prizes at Cumbres de Comunidades 2025. |
| 2025-03-12 | 120.000 | buzzparty | excess is going back to you - thank you for the support! |
| 2025-03-04 | 180.000 | arlettemsalase | Return of funds from @ jthomasewsky at the end of his trip on 2/3/2025 \| Modular Carnival \| Belo Horizonte, Brazil. |
| 2025-03-04 | 100.000 | arlettemsalase | Extra money planned for @xvlad who was unable to attend due to illness \| Modular Carnival \| Belo Horizonte, Brazil. |
| 2025-03-04 | 330.750 | arlettemsalase | Expenses of @xvlad that he used because he did not attend due to illness \| Modular Carnival \| Belo Horizonte, Brazil. |
| 2025-02-19 | 200.000 | hivecreators | Return https://hivehub.dev/tx/18350b5a04e602344bdb5c1bc7be8e7558ec2779 |
| 2025-01-31 | 1,250.000 | blackheart | To be given later |

---

## Refunds by Sender

| Sender | Count | Total Amount (HBD) |
|--------|-------|-------------------|
| talentlandfund | 2 | 3,616.070 |
| arlettemsalase | 4 | 650.750 |
| latamwallet | 3 | 1,019.000 |
| buzzparty | 2 | 2,821.570 |
| hivecuba | 2 | 565.000 |
| coldone | 1 | 2,600.000 |
| blackheart | 1 | 1,250.000 |
| hiverun | 1 | 500.000 |
| guiltyparties | 1 | 551.000 |
| ecoinstant | 1 | 551.250 |
| danielvehe | 1 | 140.700 |
| bigfluffyclouds | 1 | 4.294 |
| hivecreators | 1 | 200.000 |

---

## Monthly Breakdown

| Month | Count | Total Amount (HBD) |
|-------|-------|-------------------|
| December 2025 | 1 | 500.000 |
| October 2025 | 1 | 2,600.000 |
| September 2025 | 3 | 1,662.250 |
| August 2025 | 4 | 1,159.700 |
| June 2025 | 2 | 9.294 |
| May 2025 | 3 | 6,317.640 |
| April 2025 | 1 | 40.000 |
| March 2025 | 4 | 730.750 |
| February 2025 | 1 | 200.000 |
| January 2025 | 1 | 1,250.000 |

---

## Notes

- These refunds are **event refunds** (unused or returned event funds), NOT loan refunds
- All refunds are in HBD (Hive Backed Dollars)
- The first refund date (Dec 17, 2025) is an approximation based on "18 days ago" notation
- Data is stored in `/lib/data/event-refunds.ts`
- The system can convert these to Transaction objects using `getEventRefundsAsTransactions()`

---

## Integration

These refunds can be integrated into the metrics calculation by:

1. Importing the refund data in the metrics API route
2. Merging with transactions from the CSV
3. Ensuring they're properly marked as refunds (`isRefund: true`)

The refunds are already structured to match the Transaction interface and can be easily integrated into the existing metrics system.

