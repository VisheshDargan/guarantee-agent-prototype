# Decision logic

The agent answers one question per booking: **which payment option leaves the hotel with the most money?**

## Three layers

**1. Predict the risk (learned).** A model estimates the chance this guest does not arrive, with the booking as it stands. Its inputs fall into five groups:

- **Guest history:** past stays, past no-shows and cancellations, responses to earlier reminders.
- **Booking shape:** lead time, length of stay, party size, amount, rooms, weekday or weekend.
- **Channel:** hotel website, MakeMyTrip, Booking.com, Agoda; prepaid or pay at hotel.
- **Hotel context:** forecast occupancy for that night, festivals and local events, season.
- **Reachability:** a verified WhatsApp number, a phone that rings, an email that bounces.

**2. Price the options (learned, then calculated).** For every option the agent may use on this booking, it estimates how the no-show risk changes if the guest pays something, and the chance the guest abandons the booking because they were asked. It then compares expected loss:

```
expected loss(option) = P(no-show | option) × (room value − amount kept)
                      + P(guest drops | option) × booking value
```

It picks the option with the smallest expected loss. Room value is higher on a sold-out night, because the room cannot be resold, so asking becomes worth the friction exactly when occupancy is high.

**3. Enforce the limits (plain code).** Before anything is sent, the agent checks which options the owner allows, the maximum part-payment percentage, protected guests (repeat guests, corporate accounts, small bookings, same-day bookings) and channel rules. On an OTA booking it does not ask for money; it reconfirms, calls and alerts the desk. If the best option is not allowed, it takes the best allowed one.

## Worked example

A first-time guest books 2 nights for ₹6,400, pay at hotel, 3 days before arrival, in a festival week when the hotel is 92% full. The agent scores a 27% chance of not showing.

| Option | Chance of no-show | Chance guest drops | Expected loss |
| --- | --- | --- | --- |
| Pay at hotel | 27% | 0% | ₹1,728 |
| **Part payment, 20% (₹1,280)** | **11%** | **1%** | **₹627** |
| First-night hold (₹3,200) | 8% | 7% | ₹704 |
| Full payment (₹6,400) | 3% | 12% | ₹768 |

Part payment wins, but not by much. At 55% occupancy, pay at hotel can become the better choice, because the room could be resold. That sensitivity is the point: a fixed rule cannot see it.

## Why AI and not a rule

1. **Signals interact.** A first-time guest booking 3 days ahead in festival week is a different risk from a repeat guest on the same dates. Five variables already make hundreds of combinations per hotel.
2. **There are two predictions.** Who will not show is half the question; how many guests would walk away if asked is the other half. A rule never learns the second.
3. **It picks an amount, not a yes or no.** Nothing, a part payment, a hold or the full stay, chosen per guest.
4. **Behaviour drifts.** Festivals, wedding weekends, new OTA policies and competitors change the right answer weekly; the agent retrains on fresh outcomes and has guards that catch drift.
5. **Every hotel is different.** The model learns what is common across a group and what is specific to each hotel, so a new hotel starts from the group's knowledge.
6. **Guests answer in language.** Replies in Hindi, English or a mix need a language model, not keyword rules.
7. **It proves itself.** A permanent control group turns the claim into a measured result.
