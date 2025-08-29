const mongoose = require("mongoose");

const ShareSchema = new mongoose.Schema({
  userId: String,
  timestamp: { type: Date, default: Date.now },
  messageId: String,
  channelId: String,
});

const PartnerSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  partnerChannels: { type: [String], default: [] },
  counterChannel: { type: String, default: null },
  bannedGuilds: { type: [String], default: [] }, // saklanan yasaklı sunucu idleri veya invite kodları
  shares: { type: [ShareSchema], default: [] }, // her paylaşım kaydı
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Partner || mongoose.model("Partner", PartnerSchema);
