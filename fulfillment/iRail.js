'use strict';

let https = require('https');
let irailAPI = 'api.irail.be';

const moment = require('moment-timezone');

/*
* Function to call iRail with the parameters received from Dialogflow
*/
	
var botResponse = function (message, bot) {
	let parameters = message.entities;
	let response = "";
	let responseJson = {};

	// grabbing my custom parameters from the Dialogflow intent
	let fromStation = parameters.fromStation;
	let destStation = parameters.destStation;

	// by default, we use Brussels-North as from station, if not mentionned
	if (!fromStation) {
		fromStation = "Brussels-North";
	}

	// this variable "followingTrain" has value 0 for initial request on one traject, then increments if user asks for later trains
	let nextTrain = parameters.followingTrains;

	// Call the iRail API
	return sendiRailrequest (fromStation, destStation).then((output) => {
		response =  buildResponse (output, nextTrain);
		bot.reply (message, response);
//		nextTrain = String (parseInt (nextTrain) + 1 );
//		responseJson.speech = response;
//		responseJson.displayText = response;
//		responseJson.contextOut = [{"name":"sncbnexttrain-followup", "lifespan":2, "parameters":{"followingTrains":nextTrain}}];
//		return responseJson;
	});
}

module.exports.botResponse = botResponse;


/*
* Function to parse the JSON response from iRail.be, and produce a readable output for Dialogflow
* responseString is the complete JSON received from iRail, for example received from https://api.irail.be/connections/?from=Brussels-North&to=Dinant&format=json
* The trainNumber will be the number of the record:
* - with the first request (value=0) we parse the result for the first train 
* - when user asks "and the following one", the value of trainNumber increments, and we parse the subsequent result (next train on the list)
*/
function buildResponse (responseString, trainNumber) {
	let botAnswer = "";
	var data = JSON.parse(responseString);
	let nextTrain = data.connection[trainNumber];
	if (nextTrain) {
		let goingVia = "";
		if (nextTrain.vias)  {
		   goingVia = " You will have to change in " + nextTrain.vias.via[0].station;
		   if (nextTrain.vias.via[1])  {
			  goingVia = goingVia + " first, then in " + nextTrain.vias.via[1].station;
		   }
		   goingVia = goingVia + "."; 
		}
		else {
		   goingVia = " This is a direct train.";
		}
		let nextTrainDirection = nextTrain.departure.direction.name;
		let nextTrainPlatform = nextTrain.departure.platform;
		let departureStation = nextTrain.departure.station;
		let nextTrainDepTime = timeConverter(nextTrain.departure.time);
		let arrivalStation = nextTrain.arrival.station;
		let arrivalTime = timeConverter(nextTrain.arrival.time);
		let delayMinutes = nextTrain.departure.delay / 60;
		let delayMsg = "";
		if (delayMinutes > 0) {
			delayMsg = " (+" + delayMinutes + "mn delay)";
		}
		if (trainNumber == "0") {
			botAnswer = "The next train from " + departureStation + " to " + arrivalStation + " ";
		}
		else {
			botAnswer = "The following one ";
		}
		botAnswer = botAnswer + "leaves at " + nextTrainDepTime + delayMsg + " dir. " + nextTrainDirection + " from platform " + nextTrainPlatform + ". You will arrive in " + arrivalStation + " at " + arrivalTime + "." + goingVia;
	}
	else {
		botAnswer = "Sorry I could not find an answer to your question. Could you please try again ?";
	}
	console.log ("my bot response is: " + botAnswer);
	bot.reply (message, botAnswer);
	return botAnswer;
}

/*
* Converts from UNIX EPOCH time to local time in timezone Europe/Brussels, using Momentjs.com
*/
function timeConverter(UNIX_timestamp) {
	var time = moment.unix(UNIX_timestamp).tz("Europe/Brussels").format('HH:mm');
	return time;
}

/*
* Call iRail, like https://api.irail.be/connections/?from=Brussels-North&to=Dinant&format=json
*/
function sendiRailrequest(fromStation, destStation) {
  return new Promise((resolve, reject) => {
	
	let options = {
		host: irailAPI,
		path: '/connections/?from=' + fromStation + '&format=json&to=' + destStation
	};
	
	var request = https.request(options, 
	function(response) {
		console.log("response code is " + response.statusCode);
		var responseString = '';
		response.on('data', function(data) {
			responseString += data;
		});
		 response.on('end', function() {
			resolve (responseString);
		});
		 response.on('error', function() {
			reject (responseString);
		});
	});
	request.end();
  });
}
