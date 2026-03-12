const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "SSC Exam Practice Platform API is running" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));
