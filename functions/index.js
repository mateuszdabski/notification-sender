const functions = require('firebase-functions');
var {google} = require('googleapis');
var MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
var SCOPES = [MESSAGING_SCOPE];

var express = require('express');
var app = express(); 
var bodyParser = require('body-parser');
var router = express.Router(); 
var request = require('request');
const admin = require('firebase-admin');
admin.initializeApp();

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
exports.checkRegisteredDevices = functions.firestore
    .document('Shops/{shopId}').onWrite( async (change, context) => {
        const oShop = change.after.data();
        const aUserNames = [];
        return db.collection("Users").get().then(function(querySnapshot) {
            querySnapshot.forEach(function(doc) {
                aUserNames.push(doc.data().bluetooth);
            });
            for (var i = 0; i < oShop.devices.length; i++) {
                var oDevice = oShop.devices[i];
                oDevice.registered = aUserNames.indexOf(oDevice.name) !== -1;
            }
            return change.after.ref.set(oShop, {merge: true});
        });        
    });

exports.api = functions.https.onRequest(app);