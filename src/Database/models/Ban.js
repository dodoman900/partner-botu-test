const mongoose = require("mongoose");

const BanEntry = new mongoose.Schema({
  targetId: String,
  reason: String,
  moderatorId: String,
  timestamp: { type: Date, default: Date.now },
});

const BanSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  bans: { type: [BanEntry], default: [] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Ban || mongoose.model("Ban", BanSchema);
