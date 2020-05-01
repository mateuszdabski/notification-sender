const functions = require('firebase-functions');
var {google} = require('googleapis');
var MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
var SCOPES = [MESSAGING_SCOPE];

var express = require('express');
var app = express(); 
var bodyParser = require('body-parser');
var router = express.Router(); 
var request = require('request');
var admin = require('firebase-admin');    

// debug initialize
//var serviceAccount = require('./service-account.json');
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   databaseURL: 'https://maly-tom.firebaseio.com'
// });

// prod initialize
admin.initializeApp(functions.config().firebase);

const db = admin.firestore();

app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

router.post('/send', function(req, res){

    getAccessToken().then(function(access_token){

        var title = req.body.title; 
        var body = req.body.body; 
        var token = req.body.token; 

        request.post({
            headers:{
                Authorization: 'Bearer '+access_token
            }, 
            url: "https://fcm.googleapis.com/v1/projects/maly-tom/messages:send", 
            body: JSON.stringify(
                {
                    "message":{
                        "token" : token,
                        "notification" : {
                            "body" : body,
                            "title" : title,
                        }
                    }
                }
            )
        }, function(error, response, body){
            res.end(body);
            console.log(body);
        });
    });
});

app.use('/api', router);

exports.updateNotifications = functions.firestore.document('Notifications/Daily').onUpdate((change, context) => {
    const newValue = change.after.data();
    pushMessage(newValue);
    return true;
  });

  function pushMessage(newValue) {
    var payload = {
      data: {
        title: newValue.title,
        message: newValue.message,
        time: newValue.time,
      }
    };
  
    admin.messaging().sendToTopic("Settings", payload)
    .then(function(response) {
      console.log("Successfully sent message:", response);
    })
    .catch(function(error) {
      console.log("Error sending message:", error);
    });
  }

function getAccessToken(){
    return new Promise(function(resolve, reject){
        var key = require("./service-account.json");
        var jwtClient = new google.auth.JWT(
            key.client_email,
            null,
            key.private_key,
            SCOPES,
            null
        );
        jwtClient.authorize(function(err, tokens){
            if(err){
                reject(err);
                return; 
            }
            resolve(tokens.access_token);
        });
    });
}

// Check if found devices is already registered app
exports.checkRegisteredDevices = functions.https.onCall(async (request, context) => {
    const documentId = request.documentId
    const oShop = request.data;
    const aUserNames = [];
    return db.collection("Users").get().then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
            aUserNames.push(doc.data().bluetooth);
        });
        oShop.devices = JSON.parse(oShop.devices);
        for (var i = 0; i < oShop.devices.length; i++) {
            var oDevice = oShop.devices[i];
            oDevice.registered = aUserNames.indexOf(oDevice.name) !== -1;
            // if registered -> send notification (async!)
        }
        db.collection("Shops").doc(documentId).set(oShop, {merge: true});        
        return oShop.devices;
    });
});

exports.api = functions.https.onRequest(app);