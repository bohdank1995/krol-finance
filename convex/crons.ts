import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

/* Daily syncs, run hourly: each run refreshes the one thing that has gone longest without a sync
   (if over 20 hours), so every card ends up synced about once a day. Monobank allows one
   request per minute, so one card per run. */

const crons = cronJobs()
crons.hourly('monobank sync', { minuteUTC: 7 }, internal.monobank.sync)
crons.hourly('ibkr sync', { minuteUTC: 37 }, internal.ibkr.sync)

export default crons
