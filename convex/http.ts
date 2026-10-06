import { httpRouter } from 'convex/server'
import { auth } from './auth'

const http = httpRouter()
// Sign-in callbacks (Google) and the keys the app checks sessions against.
auth.addHttpRoutes(http)

export default http
