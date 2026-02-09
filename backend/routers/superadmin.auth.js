const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const SUPER_USER = process.env.SUPER_USER;
const SUPER_PASS = process.env.SUPER_PASS;

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (username === SUPER_USER && password === SUPER_PASS) {
    const token = jwt.sign(
      { role: "superadmin" },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({ token });
  }

  res.status(401).json({ message: "Credenciales inválidas" });
});

module.exports = router;


