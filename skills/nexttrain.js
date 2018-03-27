//
// Command: nexttrain
//
module.exports = function (sparkController, dialogflowMiddleware) {

    sparkController.hears(['next-train'], 'direct_message', dialogflowMiddleware.hears, function(bot, message) {
        bot.reply(message, 'Hello from Dialogflow !');
    });

}
