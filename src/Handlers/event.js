/*
  Events folder expectations:
  Each file in src/Events should export an object:
  module.exports = {
    name: Events.MessageCreate, // or custom string
    once: false, // optional
    async execute(...args) { ... }
  }
  This handler will register client.on / client.once accordingly.
*/

const { readdirSync } = require("node:fs");
const path = require("node:path");

module.exports = {
  async execute(client) {
    const eventsPath = path.join(__dirname, "../Events");
    const eventFiles = readdirSync(eventsPath);

    await Promise.all(
      eventFiles.map(async (file) => {
        const event = require(path.join(eventsPath, file));

        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }
      }),
    );
  },
};
