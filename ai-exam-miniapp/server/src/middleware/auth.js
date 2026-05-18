export function requireAuth(authService) {
  return async (req, res, next) => {
    const header = req.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const user = await authService.verifyToken(token)
    if (!user) {
      res.status(401).json({ success: false, message: 'unauthorized' })
      return
    }
    req.user = user
    next()
  }
}
