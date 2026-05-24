// 1. Import the tools we installed
const express = require('express');
const cors = require('cors');

// 2. Create the server app
const app = express();

// 3. Enable CORS and JSON parsing (so it can read your form data later)
app.use(cors());
app.use(express.json());

// 4. Create a "Route" (An endpoint the frontend can talk to)
app.get('/', (req, res) => {
    res.send("Hello! The PCIC Backend is alive and running!");
});

// 5. Turn the server on at port 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});