//
// Copyright (c) 2017 Cisco Systems
// Licensed under the MIT License 
//

//
// BotKit configuration
//

// Load environment variables from project .env file
require('node-env-file')(__dirname + '/.env');

if (!process.env.SPARK_TOKEN) {
    console.log("Could not start as bots require a Cisco Spark API access token.");
    console.log("Please add env variable SPARK_TOKEN on the command line or to the .env file");
    console.log("Example: ");
    console.log("> SPARK_TOKEN=XXXXXXXXXXXX PUBLIC_URL=YYYYYYYYYYYYY node bot.js");
    process.exit(1);
}

// Get public URL where Cisco Spark will post spaces notifications (webhook registration)
var public_url = process.env.PUBLIC_URL;
// Infer the app domain for popular Cloud PaaS
if (!public_url) {

    // Heroku hosting: available if dyno metadata are enabled, https://devcenter.heroku.com/articles/dyno-metadata
    if (process.env.HEROKU_APP_NAME) {
        public_url = "https://" + process.env.HEROKU_APP_NAME + ".herokuapp.com";
    }

    // Glitch hosting
    if (process.env.PROJECT_DOMAIN) {
        public_url = "https://" + process.env.PROJECT_DOMAIN + ".glitch.me";
    }
}
if (!public_url) {
    console.log("Could not start as this bot must expose a public endpoint.");
    console.log("Please add env variable PUBLIC_URL on the command line or to the .env file");
    console.log("Example: ");
    console.log("> SPARK_TOKEN=XXXXXXXXXXXX PUBLIC_URL=YYYYYYYYYYYYY node bot.js");
    process.exit(1);
}


//
// Create bot
//

var Botkit = require('botkit');

var env = process.env.NODE_ENV || "development";
var sparkController = Botkit.sparkbot({
    debug: true,
    log: true,
    public_address: public_url,
    ciscospark_access_token: process.env.SPARK_TOKEN,
    secret: process.env.SECRET, // this is a RECOMMENDED security setting that checks of incoming payloads originate from Cisco Spark
    webhook_name: process.env.WEBHOOK_NAME || ('built with BotKit (' + env + ')')
});

var bot = sparkController.spawn({
});


//
// Addition for Dialogflow middleware
//
var dialogflowMiddleware = require('botkit-middleware-dialogflow')({
    token: process.env.DIALOGFLOW_CLIENT_ACCESS_KEY,
});
sparkController.middleware.receive.use(dialogflowMiddleware.receive);


//
// Launch bot
//

var port = process.env.PORT || 3000;
sparkController.setupWebserver(port, function (err, webserver) {
    sparkController.createWebhookEndpoints(webserver, bot, function () {
        console.log("Cisco Spark: Webhooks set up!");
    });

    // installing Healthcheck
    var healthcheck = {
        "up-since": new Date(Date.now()).toGMTString(),
        "hostname": require('os').hostname() + ":" + port,
        "version": "v" + require("./package.json").version,
        "bot": "unknown",   // loaded asynchronously
        "botkit": "v" + bot.botkit.version()
    };
    webserver.get(process.env.HEALTHCHECK_ROUTE, function (req, res) {

        // As the identity is load asynchronously from Cisco Spark token, we need to check until it's fetched
        if (healthcheck.bot == "unknown") {
            var identity = bot.botkit.identity;
            if (bot.botkit.identity) {
                healthcheck.bot = bot.botkit.identity.emails[0];
            }
        }

        res.json(healthcheck);
    });
    console.log("Cisco Spark: healthcheck available at: " + process.env.HEALTHCHECK_ROUTE);
});


//
// Handling the conversation itself, with hears/say/ask/reply
//

sparkController.hears(['next-train'], 'direct_message,direct_mention', dialogflowMiddleware.hears, function(bot, message) {
    bot.reply(message, "I understood you wish to travel to :" + message.entities.destStation);
    let botResponse = "";
    require("./fulfillment/iRail.js")(message, botResponse);
    callIrail (message, botResponse);
    bot.reply(message, botResponse.speech);
});

sparkController.hears(['following-trains'], 'direct_message,direct_mention', dialogflowMiddleware.hears, function(bot, message) {
    bot.reply(message, "I understood you wish the following train to :" + message.entities.destStation);
});

sparkController.hears([/^color$/], 'direct_message,direct_mention', function (bot, message) {

    bot.startConversation(message, function (err, convo) {
        convo.say('This is a BotKit conversation sample.');
        convo.ask('What is your favorite color?', function (response, convo) {
            convo.say("Cool, I like '" + response.text + "' too!");
            convo.next();
        });
    });
});


//
// Cisco Spark Utilities
//

// Utility to add mentions if Bot is in a 'Group' space
bot.appendMention = function (message, command) {

    // if the message is a raw message (from a post message callback such as bot.say())
    if (message.roomType && (message.roomType == "group")) {
        var botName = bot.botkit.identity.displayName;
        return "`@" + botName + " " + command + "`";
    }

    // if the message is a Botkit message
    if (message.raw_message && (message.raw_message.data.roomType == "group")) {
        var botName = bot.botkit.identity.displayName;
        return "`@" + botName + " " + command + "`";
    }

    return "`" + command + "`";
}
