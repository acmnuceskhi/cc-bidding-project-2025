# ✅ Event Day Checklist

Print this or keep it open during your event!

---

## 🌅 BEFORE EVENT STARTS (30 min before)

### Pre-Flight Checks
- [ ] **Keepalive is running** (UptimeRobot or `node keepalive.js`)
- [ ] **Render service is awake** (visit homepage, should load in < 5s)
- [ ] **MongoDB is connected** (check Render logs for connection success)
- [ ] **Admin account ready** (username/password available)

### Test All Flows (10 minutes)
- [ ] Admin login works
- [ ] Admin can start a round
- [ ] Projector displays the round correctly
- [ ] House captain can login
- [ ] House captain can place a bid
- [ ] Bid appears on projector with sound/animation
- [ ] Timer counts down correctly
- [ ] Round auto-ends after timer expires
- [ ] Winner is displayed with fireworks 🎉
- [ ] Admin can start next round

### Have Ready
- [ ] Admin login credentials
- [ ] House captain login credentials (all 4)
- [ ] Projector display open in browser (full screen)
- [ ] This checklist! 📋

---

## 🎮 DURING EVENT

### Normal Operation
Monitor these:
- ✅ Render dashboard open in a tab
- ✅ Keepalive script running (or UptimeRobot active)
- ✅ Projector display working
- ✅ House captains can access their dashboards

### Every 30 Minutes
- [ ] Check Render logs for errors
- [ ] Verify keepalive is still pinging (should see log entries)
- [ ] Ask house captains if everything is working

---

## 🚨 TROUBLESHOOTING GUIDE

### Problem: Service Won't Respond (HTTP 500/503)
**Symptoms:** Page won't load, very slow responses
**Fix:**
1. Go to Render dashboard
2. Click "Manual Deploy" → "Deploy Latest Commit"
3. Wait 60 seconds for cold start
4. Test again

**Prevention:** Make sure keepalive is running!

---

### Problem: Projector Stuck on "Waiting for admin..."
**Symptoms:** Round started but projector doesn't show it
**Fix:**
1. Refresh the projector page (F5)
2. Check browser console for errors (F12)
3. If still stuck, restart the round from admin dashboard

---

### Problem: House Captain Can't Place Bid
**Symptoms:** "Insufficient budget" or "Batch limit reached"
**Possible Causes:**
- House has used all their budget (check admin overview)
- House already has 3 teams from this batch (check admin teams view)
- Round has expired (timer hit 0)

**Fix:**
- If budget issue: They need to bid lower or skip this player
- If batch limit: This is intentional, they can't bid on this batch
- If timer expired: Start next round

---

### Problem: Round Won't Auto-End
**Symptoms:** Timer hit 0 but round still "active"
**Fix:**
1. Wait 5-10 seconds (auto-end has slight delay)
2. If still stuck, admin manually ends round:
   - Go to Admin → Rounds
   - Click "End Round" button
3. If button doesn't work, restart Render service (see first problem)

---

### Problem: Users Getting Logged Out
**Symptoms:** "Authentication required" errors, redirected to login
**Fix:**
1. Have users clear browser session:
   - Press F12 → Application tab → Session Storage → Clear All
2. Re-login with credentials
3. Should work now

**Prevention:** Don't have JWT_SECRET missing in Render env vars!

---

### Problem: Bids Not Appearing on Projector
**Symptoms:** House places bid, but projector doesn't show notification
**Check:**
1. Projector is polling (check browser console for API calls)
2. House actually placed bid (check Admin → Bids view)
3. Sound might be muted (check browser audio)

**Fix:**
- Refresh projector page
- Re-place bid if needed

---

### Problem: Winner Not Displaying
**Symptoms:** Round ends but winner screen doesn't show
**Fix:**
1. Wait 3-5 seconds (there's a slight delay)
2. Refresh projector page
3. Manually check winner in Admin → Rounds → View Results

---

### 🆘 NUCLEAR OPTION: Complete System Failure

If Render is completely down and won't come back:

**Local Fallback Plan (15 minutes):**

1. On your laptop:
   ```bash
   cd /path/to/cc-bidding-project-2025
   npm run dev
   ```

2. In another terminal:
   ```bash
   # Install ngrok if you don't have it
   npm install -g ngrok
   
   # Expose local server
   ngrok http 3000
   ```

3. Share the ngrok URL (e.g., `https://abc123.ngrok.io`) with:
   - Projector operator → `/projector`
   - House captains → `/house/[houseId]`
   - Admin → `/admin`

4. Continue event as normal!

**Important:** Make sure MongoDB Atlas allows connections from any IP (0.0.0.0/0 in whitelist)

---

## 📊 MONITORING DASHBOARD

Keep these tabs open during event:

| Tab | URL | What to Watch |
|-----|-----|---------------|
| Render Logs | https://dashboard.render.com | No errors, keepalive pings |
| Admin Dashboard | /admin/overview | Budget tracking, round status |
| Projector | /projector | Visual confirmation everything works |
| MongoDB Atlas | https://cloud.mongodb.com | Connection status (optional) |

---

## 🎬 POST-EVENT (After Event Ends)

### Immediate
- [ ] Stop keepalive (UptimeRobot or kill script with Ctrl+C)
- [ ] Export data: `npm run export-bids`
- [ ] Take screenshots of final results
- [ ] Thank your team! 🎉

### Next Day
- [ ] Review Render logs for issues
- [ ] Check MongoDB data integrity
- [ ] Gather feedback from house captains
- [ ] Write post-mortem (what went well, what didn't)

---

## 📞 QUICK REFERENCE

### URLs
- **Production:** https://cc-bidding-project-2025.onrender.com
- **Render Dashboard:** https://dashboard.render.com
- **MongoDB Atlas:** https://cloud.mongodb.com

### Key Stats
- **Free Tier Limits:** 750 hours/month, 100GB bandwidth
- **Expected Load:** ~65 API requests/minute
- **Cold Start Time:** ~30 seconds
- **Polling Intervals:** Projector 4s, Houses 5s

### Default Admin Account
Check your seed data scripts or database for credentials!

---

## 💡 TIPS FOR SUCCESS

1. **Arrive Early:** Test everything 30 minutes before event
2. **Keep Calm:** Most issues are fixable in 1-2 minutes
3. **Communicate:** Tell participants if there's a delay
4. **Have Backup:** Local + ngrok ready if needed
5. **Document:** Take notes of any issues for post-mortem

---

## 🎯 SUCCESS CRITERIA

Your event is successful if:
- ✅ All rounds complete without major delays
- ✅ Bids are recorded accurately
- ✅ Winner is determined fairly (highest bid, earliest timestamp)
- ✅ Participants had a good experience
- ✅ You learned something! 🎓

---

**Remember: You've tested this, the code is solid, and you have backup plans. You got this! 🚀**

**Last updated:** November 15, 2025  
**Review docs:** `REVIEW_SUMMARY.md`, `QUICK_START_FOR_TOMORROW.md`

