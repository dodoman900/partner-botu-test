let dotenvResult;
try {
  dotenvResult = require('dotenv').config();
} catch (e) {
  console.error("Hata: 'dotenv' modülü yüklenirken bir istisna oluştu. Lütfen 'npm install dotenv' çalıştırın.\nDetay:", e.message || e);
  process.exit(1);
}

if (dotenvResult && dotenvResult.error) {
  console.error("Hata: .env dosyası yüklenemedi veya okunamadı. .env dosyanızın proje kökünde ve doğru formatta olduğundan emin olun.");
  // opsiyonel: console.error(dotenvResult.error);
  process.exit(1);
}

const token = process.env.BOT_TOKEN;

if (!token) {
  console.error("Hata: BOT_TOKEN ortam değişkeni bulunamadı. .env dosyanızı ve 'BOT_TOKEN=...' satırını kontrol edin.");
  process.exit(1);
}

// Maskeli token çıktısı (güvenlik için token'ın tamamı gösterilmez)
const masked = token.length > 8 ? `${token.slice(0,4)}...${token.slice(-4)}` : '***';
if (token.length < 20) {
  console.warn(`Uyarı: BOT_TOKEN beklenenden kısa görünüyor (maskeli: ${masked}). Geçerli token kullandığınızdan emin olun.`);
} else {
  console.log(`BOT_TOKEN bulundu (maskeli): ${masked}`);
}

/*
  Ayarlar: owners ve token zaten mevcut.
  Ek: LOG_CHANNEL_ID ortam değişkeni ile hata paneline mesaj gönderebilirsiniz.
*/
module.exports = {
  prefix: "!",
  owners: ["782215331765813258"],
  token: process.env.BOT_TOKEN,
  logChannelId: process.env.LOG_CHANNEL_ID || null,
  hataChannelId: process.env.HATA_KANALI || process.env.HATA_KANAL || null,
};
