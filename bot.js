// bot.js
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

// ================= SAFE MODE =================
process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

// ================= KEEP ALIVE =================
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("GS Bot Online");
}).listen(process.env.PORT || 3000);

// ================= DATABASE =================
const DB_FILE = "./applications.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, "[]");
}

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
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

// ================= SERVER SETUP =================
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
  await ensureChannel(guild, "📜・rules", "Rules");
  await ensureChannel(guild, "📢・announcements", "Announcements");
  await ensureChannel(guild, "🔗・links", "Links");
}

async function sendWelcomeApplyPanel(guild) {
  const channel = guild.channels.cache.find(c =>
    c.name.includes("welcome")
  );

  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle("👋 Welcome to MMEC Club")
    .setDescription("To join the club, click the button below and complete your application.")
    .setColor("Blue");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_apply")
      .setLabel("Apply Now")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({
    embeds: [embed],
    components: [row]
  }).catch(() => {});
}

// ================= READY =================
client.once(Events.ClientReady, async () => {
  console.log(`🚀 Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await setupServer(guild);
    await sendWelcomeApplyPanel(guild);
  }
});

// ================= MEMBER JOIN =================
client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.channels.cache.find(c =>
    c.name.includes("welcome")
  );

  if (channel) {
    await channel.send(`👋 Welcome <@${member.id}>`);
  }

  try {
    await member.send("👋 Welcome! Please go to #welcome and click Apply Now.");
  } catch {}
});

// ================= OPEN FORM FUNCTION =================
async function showApplyModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("apply_form")
    .setTitle("MMEC Application Form");

  const name = new TextInputBuilder()
    .setCustomId("name")
    .setLabel("Full Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const email = new TextInputBuilder()
    .setCustomId("email")
    .setLabel("Email")
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
    new ActionRowBuilder().addComponents(email),
    new ActionRowBuilder().addComponents(id),
    new ActionRowBuilder().addComponents(batch)
  );

  await interaction.showModal(modal);
}

// ================= ONE INTERACTION HANDLER =================
client.on(Events.InteractionCreate, async (interaction) => {
  try {

    // ========= SLASH COMMAND =========
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === "apply") {
        return await showApplyModal(interaction);
      }

      if (interaction.commandName === "setup") {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({
            content: "Admin only",
            ephemeral: true
          });
        }

        await setupServer(interaction.guild);

        return interaction.reply({
          content: "✅ MMEC Server Setup Completed",
          ephemeral: true
        });
      }
    }

    // ========= BUTTONS =========
    if (interaction.isButton()) {

      // open apply form
      if (interaction.customId === "open_apply") {
        return await showApplyModal(interaction);
      }

      // admin check for accept/reject
      if (
        interaction.customId.startsWith("accept_") ||
        interaction.customId.startsWith("reject_")
      ) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return interaction.reply({
            content: "Admin only",
            ephemeral: true
          });
        }

        const db = loadDB();
        const userId = interaction.customId.split("_")[1];
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        const app = db.find(x => x.userId === userId);

        if (!app) {
          return interaction.reply({
            content: "Application not found.",
            ephemeral: true
          });
        }

        // ACCEPT
        if (interaction.customId.startsWith("accept_")) {
          app.status = "ACCEPTED";
          saveDB(db);

          let role = interaction.guild.roles.cache.find(r => r.name === "MEMBER");
          if (role && member) await member.roles.add(role).catch(() => {});

          if (member) {
            await member.setNickname(app.name).catch(() => {});
            await member.send("🎉 Your application has been ACCEPTED!").catch(() => {});
          }

          const welcomeChannel = interaction.guild.channels.cache.find(c =>
            c.name.includes("welcome")
          );

          if (welcomeChannel) {
            await welcomeChannel.send(`🎉 Welcome ${app.name} | Eng. 🚀`);
          }

          return interaction.reply({
            content: `✅ Accepted <@${userId}>`,
            ephemeral: true
          });
        }

        // REJECT
        if (interaction.customId.startsWith("reject_")) {
          app.status = "REJECTED";
          saveDB(db);

          if (member) {
            await member.send("❌ Your application has been REJECTED.").catch(() => {});
          }

          return interaction.reply({
            content: `❌ Rejected <@${userId}>`,
            ephemeral: true
          });
        }
      }
    }

    // ========= MODAL SUBMIT =========
    if (interaction.isModalSubmit()) {

      if (interaction.customId !== "apply_form") return;

      const db = loadDB();

      if (db.find(x => x.userId === interaction.user.id)) {
        return interaction.reply({
          content: "❌ You already applied.",
          ephemeral: true
        });
      }

      const name = interaction.fields.getTextInputValue("name");
      const email = interaction.fields.getTextInputValue("email");
      const id = interaction.fields.getTextInputValue("id");
      const batch = interaction.fields.getTextInputValue("batch");

      const newApp = {
        userId: interaction.user.id,
        name,
        email,
        universityId: id,
        batch,
        status: "PENDING",
        createdAt: new Date().toISOString()
      };

      db.push(newApp);
      saveDB(db);

      const channel = interaction.guild.channels.cache.find(c =>
        c.name.includes("applications")
      );

      if (!channel) {
        return interaction.reply({
          content: "❌ Applications channel not found.",
          ephemeral: true
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("📥 New Application")
        .setColor("Yellow")
        .addFields(
          { name: "Name", value: name },
          { name: "Email", value: email },
          { name: "ID", value: id },
          { name: "Batch", value: batch },
          { name: "User", value: `<@${interaction.user.id}>` },
          { name: "Status", value: "PENDING ⏳" }
        );

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`accept_${interaction.user.id}`)
          .setLabel("Accept")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId(`reject_${interaction.user.id}`)
          .setLabel("Reject")
          .setStyle(ButtonStyle.Danger)
      );

      await channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content: "✅ Application submitted successfully",
        ephemeral: true
      });
    }

  } catch (error) {
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Unexpected error.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN)
  .then(() => console.log("✅ Discord Connected"))
  .catch(err => console.error("❌ Login Error:", err));
