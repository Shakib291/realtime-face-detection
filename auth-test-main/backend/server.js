const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// Fallback for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const users = []; // In-memory users: { email, passwordHash }
const resetTokens = {}; // In-memory reset tokens: token -> email

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";

app.get("/", (req, res) => {
  res.send("Welcome to the Authentication API");
});

// Register
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (users.find((u) => u.email === email)) {
    return res.status(400).json({ message: "User already exists" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  users.push({ email, passwordHash });
  res.json({ message: "Registration successful" });
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(400).json({ message: "User not found" });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: "Invalid password" });

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });

  // Call Python script with email argument
  const scriptPath = path.resolve(__dirname, "../../main.py");
  const python = spawn("python", [scriptPath, email]);

  python.stdout.on("data", (data) => {
    console.log(`Python says: ${data}`);
  });

  python.stderr.on("data", (data) => {
    console.error(`Python error: ${data}`);
  });

  python.on("close", (code) => {
    console.log(`Python process exited with code ${code}`);
    res.json({
      message: "Login successful, face recognition attempted.",
      token,
      pythonExitCode: code,
    });
  });
});

// Logout
app.post("/logout", (req, res) => {
  // No server-side session, just respond
  res.json({ message: "Logout successful (remove token on client side)" });
});

// Forgot password (generate token)
app.post("/forgot-password", (req, res) => {
  const { email } = req.body;
  const user = users.find((u) => u.email === email);
  if (!user) return res.status(400).json({ message: "User not found" });

  const resetToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: "15m" });
  resetTokens[resetToken] = email;

  // In production, send token by email
  res.json({ message: "Password reset link generated", resetToken });
});

// Reset password
app.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = resetTokens[token];
    if (!email)
      return res.status(400).json({ message: "Invalid or expired token" });

    const user = users.find((u) => u.email === email);
    if (!user) return res.status(400).json({ message: "User not found" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    delete resetTokens[token];

    res.json({ message: "Password has been reset" });
  } catch (err) {
    res.status(400).json({ message: "Invalid or expired token" });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
