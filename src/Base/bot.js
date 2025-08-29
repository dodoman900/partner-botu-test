const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { readdirSync } = require("node:fs");
const path = require("node:path");
const ayarlar = require("./ayarlar.js");

class BaseClient {
  constructor(token) {
    this.client = new Client({
      // Sadece gerekli intentleri açıkça ekleyin.
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // messageCreate içinde message.content kullanıldığı için gerekiyor
      ],
      partials: Object.values(Partials),
      shards: "auto",
    });
    this.token = token;
  }

  async loadHandlers() {
    const handlersPath = path.join(__dirname, "..", "Handlers");
    let files = readdirSync(handlersPath);
    // Logger'ı önce çalıştır (varsa) ki client.logger diğer handlerlar tarafından kullanılabilsin
    files = files.sort((a, b) => {
      if (a.toLowerCase() === "logger.js") return -1;
      if (b.toLowerCase() === "logger.js") return 1;
      return 0;
    });

    for (const file of files) {
      const handler = require(path.join(handlersPath, file));
      if (typeof handler.execute === "function") await handler.execute(this.client);
    }
  }

  async start() {
    await this.loadHandlers();
    try {
      await this.client.login(this.token);
    } catch (e) {
      console.error("Giriş hatası:", e.message || e);
      console.error("Not: Eğer 'Message Content' gibi ayrıcalıklı intent kullanıyorsanız, Discord Developer Portal'dan botunuz için bu intentleri etkinleştirmeniz gerekir.");
      process.exit(1);
    }
  }
}

const token = ayarlar.token;
const client = new BaseClient(token);
client.start().catch((e) => {
  console.error(e);
  process.exit(1);
});
