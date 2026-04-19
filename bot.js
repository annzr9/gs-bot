const {
  Client,
  GatewayIntentBits,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

require("dotenv").config();
const fs = require("fs");
const http = require("http");

// ================= 24/7 + ANTI CRASH =================
process.on("unhandledRejection", (err) => {
  console.error("⚠️ Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("💥 Uncaught Exception:", err);
});

// ================= KEEP ALIVE =================
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("MMEC BOT 24/7 ONLINE");
}).listen(process.env.PORT || 3000, () => {
  console.log("🌐 KeepAlive Active");
});

// ================= DATABASE =================
const DB_FILE = "./applications.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, "[]");
}

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ================= CHANNEL SETUP =================
async function ensureChannel(guild, name, topic = "") {
  let channel = guild.channels.cache.find(c => c.name === name);

  if (!channel) {
    channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      topic
    });
  }

  return channel;
}

async function setupServer(guild) {
  await ensureChannel(guild, "📥・applications", "Applications");
  await ensureChannel(guild, "👋・welcome", "Welcome");
  await ensureChannel(guild, "📜・rules", "Server Rules");
  await ensureChannel(guild, "📢・announcements", "Announcements");
  await ensureChannel(guild, "🔗・links", "Links");
}

// ================= APPLY PANEL =================
async function sendApplyPanel(guild) {
  const channel = guild.channels.cache.find(c =>
    c.name.includes("welcome")
  );

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 MMEC Club")
    .setDescription("Click below to apply and join officially.")
    .setColor("Blue");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_apply")
      .setLabel("Apply Now")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] }).catch(() => {});
}

// ================= MODAL =================
function buildModal() {
  const modal = new ModalBuilder()
    .setCustomId("apply_form")
    .setTitle("MMEC Application Form");

  const name = new TextInputBuilder()
    .setCustomId("name")
    .setLabel("Full Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const number = new TextInputBuilder()
    .setCustomId("number")
    .setLabel("Phone Number / ID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const id = new TextInputBuilder()
    .setCustomId("id")
    .setLabel("University ID")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const batch = new TextInputBuilder()
    .setCustomId("batch")
    .setLabel("Batch / Year")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(number),
    new ActionRowBuilder().addComponents(id),
    new ActionRowBuilder().addComponents(batch)
  );

  return modal;
}

// ================= READY =================
client.once(Events.ClientReady, async () => {
  console.log(`🚀 Logged in as ${client.user.tag}`);

  // 🔥 Anti Idle Presence
  const setStatus = () => {
    client.user.setPresence({
      status: "online",
      activities: [
        {
          name: "MMEC Club 24/7",
          type: 3
        }
      ]
    }).catch(() => {});
  };

  setStatus();
  setInterval(setStatus, 60000);

  for (const guild of client.guilds.cache.values()) {
    await setupServer(guild);
    await sendApplyPanel(guild);
  }
});

// ================= JOIN =================
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.find(c =>
    c.name.includes("welcome")
  );

  channel?.send(`👋 Welcome <@${member.id}>`);

  member.send("👋 Welcome to MMEC Club! Go to #welcome and apply.").catch(() => {});
});

// ================= INTERACTIONS =================
client.on(Events.InteractionCreate, async (interaction) => {
  try {

    // ===== SLASH =====
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === "apply") {
        return interaction.showModal(buildModal());
      }

      if (interaction.commandName === "setup") {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: "Admin only.", ephemeral: true });
        }

        await setupServer(interaction.guild);

        return interaction.reply({ content: "✅ Setup completed", ephemeral: true });
      }
    }

    // ===== BUTTON =====
    if (interaction.isButton()) {

      if (interaction.customId === "open_apply") {
        return interaction.showModal(buildModal());
      }

      if (interaction.customId.startsWith("accept_") ||
          interaction.customId.startsWith("reject_")) {

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({ content: "Admin only", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.customId.split("_")[1];
        const db = loadDB();
        const app = db.find(x => x.userId === userId);

        if (!app) return interaction.editReply("Not found");

        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (interaction.customId.startsWith("accept_")) {

          app.status = "ACCEPTED";
          saveDB(db);

          const role = interaction.guild.roles.cache.find(r => r.name === "MEMBER");
          if (role && member) await member.roles.add(role).catch(() => {});

          if (member) {
            member.setNickname(app.name).catch(() => {});
            member.send("🎉 Accepted!").catch(() => {});
          }

          return interaction.editReply("Accepted");
        }

        if (interaction.customId.startsWith("reject_")) {

          app.status = "REJECTED";
          saveDB(db);

          member?.send("❌ Rejected").catch(() => {});

          return interaction.editReply("Rejected");
        }
      }
    }

    // ===== MODAL =====
    if (interaction.isModalSubmit() && interaction.customId === "apply_form") {

      await interaction.deferReply({ ephemeral: true });

      const db = loadDB();

      if (db.find(x => x.userId === interaction.user.id)) {
        return interaction.editReply("Already applied");
      }

      const newApp = {
        userId: interaction.user.id,
        name: interaction.fields.getTextInputValue("name"),
        number: interaction.fields.getTextInputValue("number"),
        universityId: interaction.fields.getTextInputValue("id"),
        batch: interaction.fields.getTextInputValue("batch"),
        status: "PENDING",
        createdAt: new Date().toISOString()
      };

      db.push(newApp);
      saveDB(db);

      const channel = interaction.guild.channels.cache.find(c =>
        c.name.includes("applications")
      );

      const embed = new EmbedBuilder()
        .setTitle("📥 New Application")
        .setColor("Yellow")
        .addFields(
          { name: "Name", value: newApp.name },
          { name: "Number", value: newApp.number },
          { name: "ID", value: newApp.universityId },
          { name: "Batch", value: newApp.batch },
          { name: "User", value: `<@${newApp.userId}>` }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_${newApp.userId}`)
          .setLabel("Accept")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`reject_${newApp.userId}`)
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({ embeds: [embed], components: [row] });

      return interaction.editReply("Submitted ✅");
    }

  } catch (err) {
    console.error(err);

    if (!interaction.replied) {
      interaction.reply({ content: "Error occurred", ephemeral: true }).catch(() => {});
    }
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN)
  .then(() => console.log("✅ Connected"))
  .catch(console.error);
