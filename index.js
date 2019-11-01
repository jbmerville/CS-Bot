"use strict";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const token = "myverifytoken";
const request = require("request"),
  express = require("express"),
  body_parser = require("body-parser"),
  app = express().use(body_parser.json());

app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));

// webhook callbacks 
app.post("/webhook", function(req, res) {
  if (req.body.object == "page") {
    req.body.entry.forEach(function(entry) {
      // Iterate over each messaging event
      if (entry.messaging) {
        entry.messaging.forEach(function(event) {
          if (event.postback) {
            console.log(event);
            processPostback(event);
          } else if (event.message) {
            processMessage(event);
          }
        });
      }
    });
    res.sendStatus(200);
  }
});

// Connect webhook 
app.get("/webhook/", function(req, res) {
  if (req.query["hub.verify_token"] === token) {
    console.log(req.query);
    res.send(req.query["hub.challenge"]);
  }
  res.send("Error, wrong token");
});

// Handles messages events
function handleMessage(user_id, message, name) {
  let response;

  if (message.text) {
    response = {
      text: "Hi " + name + ", Find a Team or find teamate",
      quick_replies: [
        {
          content_type: "text",
          title: "Team",
          payload: "team"
        },
        {
          content_type: "text",
          title: "Teamate",
          payload: "teamate"
        }
      ]
    };
  }

  sendMessage(user_id, response);
}

// Sends message to the user
async function sendMessage(userId, message) {
  request(
    {
      uri: "https://graph.facebook.com/v2.6/me/messages",
      qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
      method: "POST",
      json: {
        recipient: { id: userId },
        message: message
      }
    },
    (err, res, body) => {
      if (!err) {
        console.log("message sent!");
      } else {
        console.error("Unable to send message:" + err);
      }
    }
  );
}

function findType(userId) {
  let message = {
    text: "Find team or create team?",
    quick_replies: [
      {
        content_type: "text",
        title: "Find",
        payload: "Find"
      },
      {
        content_type: "text",
        title: "Create",
        payload: "Create"
      }
    ]
  };
  sendMessage(userId, message);
}

function processPostback(event) {
  let userId = event.sender.id;
  let payload = event.postback.payload;
  if (payload === "Greetings") {
    request(
      {
        uri: "https://graph.facebook.com/" + userId,
        qs: { access_token: process.env.PAGE_ACCESS_TOKEN },
        method: "GET"
      },
      (err, res, body) => {
        if (!err) {
          let name = JSON.parse(body).first_name;
          let message = {
            text:
              "Hi " +
              name +
              ", my name is MatchCS Bot. I can help you find a match!"
          };
          // Find what the user wants
          sendMessage(userId, message).then(findType(userId));
        } else {
          console.error("Error getting user name:" + err);
        }
      }
    );
  } else if (payload === "Find") {
  } else if (payload == "Create") {
  }
}

function processMessage(event) {}

