"use strict";
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const token = process.env.VERIFICATION_TOKEN;
const request = require("request"),
  express = require("express"),
  body_parser = require("body-parser"),
  mongoose = require("mongoose"),
  User = require("./user"),
  app = express().use(body_parser.json());

var db = mongoose.connect(
  process.env.MONGODB_URI,
  { useMongoClient: true },
  err => {
    console.log(err ? err : "mongodb is connected");
  }
);

app.listen(process.env.PORT || 1337, () => console.log("webhook is listening"));

// webhook callbacks
app.post("/webhook", function(req, res) {
  if (req.body.object == "page") {
    req.body.entry.forEach(function(entry) {
      // Iterate over each messaging event
      if (entry.messaging) {
        entry.messaging.forEach(function(event) {
          if (event.postback) {
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

// Sends message to the user
function sendMessage(userId, message) {
  return new Promise(function(resolve, reject) {
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
      err => {
        if (!err) {
          resolve();
          console.log("message sent!");
        } else {
          console.error("Unable to send message:" + err);
          reject(err);
        }
      }
    );
  });
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
      async (err, res, body) => {
        if (!err) {
          let name = JSON.parse(body).first_name;
          let message = {
            text:
              "Hi " +
              name +
              ", my name is MatchCS Bot. I can help you find a match for your CS project!"
          };
          await sendMessage(userId, message);
          createUser(userId, name);
        } else {
          console.error("Error getting user name:" + err);
        }
      }
    );
  }
}

function createUser(userId, name) {
  let user = {
    userId: userId,
    name: name,
    profile: "https://www.facebook.com/profile?id=" + userId,
    found: false,
    step: 1
  };
  User.update({ userId: userId }, user, { upsert: true }, err => {
    if (err) {
      console.log("Error creating a user: " + err);
      sendMessage(userId, {
        text:
          "Error occured when creating a new user. Please delete conversation and try again."
      });
    } else {
      console.log("User successfuly created.");
      // Find what the user wants once User created in Mongodb.
      sendQuestion(userId, 1);
    }
  });
}

function processMessage(event) {
  let userId = event.sender.id;
  let message = event.message;
  // console.log(message);

  User.findOne({ userId: userId }, async function(err, user) {
    // User found.
    if (!err) {
      console.log(user);
      // Message is from one of the quick replies.
      if (message.text || message.quick_reply) {
        let step = user.step;
        let update;
        switch (step) {
          case 1:
            update = {
              canBeContacted: message.text === "Yes" ? true : false,
              step: ++step
            };
            break;
          case 2:
            update = {
              hasProject: message.text === "Have one" ? true : false,
              step: ++step
            };
            break;
          case 3:
            update = {
              aboutUser: message.text,
              step: ++step
            };
            break;
          case 4:
            update = {
              found: message.text === "Yes" ? true : false,
              step: message.text === "Yes" ? ++step : step
            };
            break;
        }
        User.findOneAndUpdate(
          { userId: userId },
          {
            $set: update
          },
          (err, body) => {
            if (err) console.log("Error while updating user: " + err);
            else console.log("User updated on step " + body.step);
          }
        );
        sendQuestion(userId, step);
      } else {
        message = {
          text: "Sorry I don't understand your answer."
        };
        await sendMessage(userId, message);
        // Send the quick reply again.
        sendQuestion(userId, user.step);
      }
    } else {
      console.log("User not found.");
    }
  });
}

function sendQuestion(userId, step) {
  let message;
  switch (step) {
    case 1:
      message = {
        text:
          "First I need to ask you some questions. Would you like to be contacted by other people?",
        quick_replies: [
          {
            content_type: "text",
            title: "Yes",
            payload: "CanContact"
          },
          {
            content_type: "text",
            title: "No",
            payload: "CanContact"
          }
        ]
      };
      break;
    case 2:
      message = {
        text: "Do you already have a project or are you looking to join one?",
        quick_replies: [
          {
            content_type: "text",
            title: "Have one",
            payload: "HasProject"
          },
          {
            content_type: "text",
            title: "Looking for one",
            payload: "HasProject"
          }
        ]
      };
      break;
    case 3:
      message = {
        text: "Can you tell me more about what you would like to work on?"
      };
      break;

    case 4:
      sendMessage(userId, { text: "Ok let me see if I can find someone..." });
      findUser(userId);
      break;
  }
  sendMessage(userId, message);
}

function findUser(userId) {
  User.find(
    {
      userId: { $ne: userId },
      canBeContacted: true,
      hasProject: true
    },
    (err, users) => {
      if (err) {
        console.log("Error while updating user: " + err);
      } else if (users.length > 0) {
        // pick a random user.
        let user = users[0];
        let message = {
          text:
            user.name +
            " says: '" +
            user.aboutUser +
            "', contact him here: " +
            user.profile
        };
        sendMessage(userId, message);
      } else {
        console.log("No users found :(");
      }
    }
  );
}

