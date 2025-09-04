export default function handler(req, res) {
  const { id } = req.query
  res.status(200).json({ 
    message: 'Dynamic route test working',
    id: id,
    method: req.method,
    timestamp: new Date().toISOString()
  })
}
