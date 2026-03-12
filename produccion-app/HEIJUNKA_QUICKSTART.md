# Heijunka Dashboard - Quick Start Guide

## Access the Dashboard
1. Click **"Heijunka"** in the navigation menu
2. You'll see the Heijunka Production Planning dashboard

## Main Components

### Left Sidebar (Input Panel)
- **Tabs**: Production Batches | Maintenance | Setup/Tooling
- **Input Forms**: Add new items
- **Lists**: View scheduled items

### Center/Right (Calendar View)
- **24-hour timeline**: 7am to 7am next day
- **7 columns**: Monday to Sunday
- **Color blocks**: Show what's scheduled when

## Step-by-Step: Schedule a Production Run

### Step 1: Add Production Batches
1. Go to **"Production Batches"** tab
2. Enter:
   - **PN**: E.g., `MOTOR-2024-001`
   - **Quantity**: E.g., `500`
   - **Hour Rate**: E.g., `100` (pieces per hour)
3. Click **"+ Add Batch"**
4. Repeat for more batches

### Step 2: (Optional) Add Maintenance
1. Go to **"Maintenance"** tab
2. Select **Start Time**: E.g., `14:00`
3. Enter **Duration**: E.g., `2` hours
4. Click **"+ Add Maintenance"**

### Step 3: (Optional) Add Setup/Tooling
1. Go to **"Setup/Tooling"** tab
2. Select **Start Time**: E.g., `09:00`
3. Enter **Duration**: E.g., `1` hour
4. Click **"+ Add Setup"**

### Step 4: View Schedule
- Look at the **Calendar Grid**
- **Blue blocks** = Production batches
- **Red blocks** = Maintenance
- **Light blue blocks** = Setup
- Click different days to see schedules for each

## Example Scenario

**Scenario**: Schedule 3 production batches on Monday

### Input Data:
| Batch | PN | Qty | Rate |
|-------|----|----|------|
| 1 | PN-A1 | 200 | 50 |
| 2 | PN-B2 | 150 | 75 |
| 3 | PN-C3 | 100 | 25 |

### Timeline (7am - 7pm):
```
7:00 - 9:00  → Batch 1 (200÷50 = 4h)
9:00 - 11:00 → Batch 2 (150÷75 = 2h)  
11:00 - 15:00 → Batch 3 (100÷25 = 4h)
15:00 - 19:00 → Next day continuation
```

### To Create This:
1. **Tab**: Production Batches
2. **Add Batch 1**: PN-A1, 200, 50
3. **Add Batch 2**: PN-B2, 150, 75
4. **Add Batch 3**: PN-C3, 100, 25
5. View on Monday column in calendar

## Quick Tips

### ✓ DO
- Plan maintenance during low-production hours
- Round hour rates to realistic numbers
- Check calendar view to verify placements
- Remove items you don't need

### ✗ DON'T
- Enter hour rate of 0 (won't calculate)
- Add maintenance/setup with 0 duration
- Use production rates higher than machine capacity
- Forget to check all 7 days before executing

## Common Tasks

### Remove a Batch
1. Go to **Production Batches** tab
2. Click **×** button on the batch
3. It's removed from schedule

### Change Start Time for Maintenance
1. Remove old maintenance (× button)
2. Add new maintenance with correct time

### Clear Everything
1. Click **"Clear All Schedule"** button
2. All batches, maintenance, setup removed
3. Start fresh

## Time Format Notes
- **Start Time fields**: Use 24-hour format (e.g., 14:00 = 2pm)
- **Calendar display**: Also shows 24-hour format (07:00-23:00)
- **Duration**: Always in hours (can use decimal: 1.5)

## Understanding the Display

### Calendar Grid
```
        Monday      Tuesday     Wednesday
7:00 ┌─────────┐  ┌─────────┐  ┌─────────┐
     │ BATCH 1 │  │BATCH 2  │  │         │
9:00 │PN-001  │  │PN-002  │  │MAINT    │
     │200 pcs │  │150 pcs │  │         │
11:00├─────────┤  ├─────────┤  ├─────────┤
     │BATCH 1 │  │BATCH 2  │  │SETUP    │
     │(cont)  │  │(cont)  │  │(tooling)│
```

## Keyboard Shortcuts (if configured)
- Currently: None (use mouse/touchpad)
- Future versions may include shortcuts

## FAQ

**Q: Can I schedule production 24/7?**
A: Yes! The 7am-7am window is just the default. You can overlap into night shifts.

**Q: What if a batch doesn't fit in one day?**
A: It continues to the next day. The "continues next day" indicator shows this.

**Q: Can I use decimal hour rates?**
A: Yes! E.g., 25.5 pcs/hour is valid.

**Q: How many batches can I add?**
A: Unlimited, but they must fit in 24 hours or will carry over.

**Q: Can I edit a batch after adding?**
A: Currently: Remove and re-add. Future: Direct editing coming.

## Getting Help

- Check **"?" button** for tooltips (if available)
- Read full [HEIJUNKA_GUIDE.md](./HEIJUNKA_GUIDE.md) for detailed docs
- Contact your production manager

---

**Happy Planning!** 🏭⏰
