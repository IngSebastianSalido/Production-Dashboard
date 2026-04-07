# Heijunka Production Planning Dashboard

## Overview
The Heijunka dashboard is a production planning tool designed to help you schedule production batches efficiently across a 7am-7am work cycle. It incorporates maintenance blocks and setup/tooling time to create an optimal production schedule.

## Features

### 1. **Production Batch Scheduling**
- **Add Batches**: Input Part Numbers (PN), quantities, and production rates (pieces/hour)
- **Sequential Scheduling**: Batches are automatically scheduled one after another based on their production time
- **Batch List**: View all scheduled batches with their details:
  - Part Number
  - Quantity (pieces)
  - Hour Rate (pieces/hour)
  - Required Time (calculated)

### 2. **Calendar View**
- **7am-7am Timeline**: Shows a full 24-hour production window from 7am to 7am the next day
- **Week View**: Monday through Sunday with date indicators
- **Color-Coded Blocks**:
  - **Blue/Purple**: Production batches
  - **Red/Pink**: Maintenance periods
  - **Light Blue**: Setup/tooling time
- **Interactive Day Selection**: Click any day to view or edit its schedule

### 3. **Maintenance Scheduling**
- **Schedule Maintenance**: Select start time and duration (in hours)
- **Blocking Logic**: Maintenance blocks prevent production from being scheduled during these times
- **Multiple Blocks**: Add as many maintenance windows as needed
- **Visual Indication**: Maintenance blocks clearly marked on the calendar

### 4. **Setup/Tooling Management**
- **Schedule Setup**: Define when tooling changes or equipment configuration occurs
- **Duration Selection**: Specify how long setup takes (in hours)
- **Production Impact**: Setup time is reserved and prevents production scheduling
- **Multiple Setups**: Add multiple setup windows for different production stages

## How It Works

### Schedule Calculation
1. The system starts at 7am (beginning of the work day)
2. It checks available hours (those not blocked by maintenance or setup)
3. For each batch, it calculates hours needed: `Hours = Quantity ÷ Hour Rate`
4. Batches are placed sequentially in available time slots
5. When one batch completes, the next batch starts immediately

### Example
```
Given:
- Batch 1: PN-001, 100 pieces, 50 pcs/hour = 2 hours
- Maintenance: 10:00-11:00 = 1 hour blocked
- Batch 2: PN-002, 150 pieces, 30 pcs/hour = 5 hours

Schedule:
- 7:00-9:00: Batch 1 (PN-001) - 100 pieces
- 9:00-10:00: Available
- 10:00-11:00: MAINTENANCE
- 11:00-16:00: Batch 2 (PN-002) - 150 pieces
```

## Navigation

### Tabs in Sidebar
1. **Production Batches**
   - Add new production batches
   - View scheduled batches
   - Remove batches from schedule

2. **Maintenance**
   - Schedule maintenance windows
   - View maintenance blocks
   - Remove maintenance slots

3. **Setup/Tooling**
   - Schedule setup/tooling time
   - View setup blocks
   - Remove setup slots

### Week Selector
Click on any day of the week to focus on that day's schedule. The calendar updates to show batch placements for the selected day.

## Controls

### Adding Items
1. **Production Batch**:
   - Enter Part Number (PN)
   - Enter Quantity (pieces)
   - Enter Hour Rate (pieces/hour)
   - Click "+ Add Batch"

2. **Maintenance**:
   - Select Start Time
   - Enter Duration (hours)
   - Click "+ Add Maintenance"

3. **Setup/Tooling**:
   - Select Start Time
   - Enter Duration (hours)
   - Click "+ Add Setup"

### Removing Items
Click the "×" button on any scheduled item to remove it from the schedule.

### Clear Schedule
Use "Clear All Schedule" button to remove all batches, maintenance, and setup at once.

## Tips & Best Practices

1. **Hour Rate Calculation**
   - Calculate based on your equipment's actual capacity
   - Consider: machine speed, manual time, quality checks
   - Use historical data for accuracy

2. **Maintenance Scheduling**
   - Schedule major maintenance outside peak hours if possible
   - Plan around shift changes
   - Account for cooldown periods

3. **Setup Time**
   - Include tool change time
   - Consider equipment warmup
   - Account for quality verification

4. **Production Order**
   - Add batches in the order you want them produced
   - Group similar PNs to minimize setup changes
   - Check tool availability before scheduling

5. **Reviewing Schedules**
   - Check each day of the week separately
   - Ensure no batch extends beyond available hours
   - Verify maintenance doesn't conflict with critical batches

## Technical Details

### Files Structure
```
src/
├── pages/
│   └── HeijunkaPage.jsx          # Main page component
├── components/
│   └── Heijunka/
│       ├── HeijunkaCalendar.jsx  # Calendar display component
│       ├── HeijunkaCalendar.css  # Calendar styles
│       ├── HeijunkaSidebar.jsx   # Input sidebar component
│       └── HeijunkaSidebar.css   # Sidebar styles
├── styles/
│   └── HeijunkaPage.css          # Page-level styles
└── utils/
    └── heijunkaUtils.js          # Scheduling logic functions
```

### Key Functions (heijunkaUtils.js)
- `generateSchedule()`: Creates production schedule
- `calculateBatchTime()`: Computes batch duration
- `isTimeSlotAvailable()`: Checks slot availability
- `getScheduleWithTiming()`: Gets detailed timing info

## Roadmap / Future Enhancements

Potential features for future releases:
- Save and load schedule templates
- Export schedule to PDF or Excel
- Real-time production progress tracking
- Batch priority levels
- Multiple machine scheduling
- Resource availability calendar
- Integration with production data API
- Shift-based scheduling
- Capacity warnings
- Historical analytics

## Troubleshooting

### Items not appearing on calendar
- Check if time slot is blocked by maintenance/setup
- Verify hour rate is greater than 0
- Ensure quantity is a positive number

### Batch extends beyond 7am next day
- Add more production time
- Reduce batch quantity
- Increase hour rate
- Remove conflicting maintenance blocks

### Cannot add maintenance/setup
- Verify time format (HH:MM)
- Check duration is at least 1 hour
- Ensure no overlapping times for same day

## Contact & Support

For issues or feature requests, contact the production planning team.

---

**Last Updated**: January 23, 2026
**Version**: 1.0.0
