export default function handler(req, res) {
    // Log them for debugging in Vercel's function logs:
    console.log("DEBUG HEADERS:", req.headers);
  
    // Return them in the response so you can see them in the browser:
    res.json({ headers: req.headers });
  }
  