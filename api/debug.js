// api/debug.js
export default function handler(req, res) {
    res.json({
      message: 'Hello from /api/debug!',
      headers: req.headers,
      userAgent: req.headers['user-agent'],
    });
  }
  