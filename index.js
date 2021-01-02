const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const MongoClient = require('mongodb').MongoClient;
const fileUpload = require('express-fileupload');
const fs = require('fs-extra');
const ObjectId = require("mongodb").ObjectID;
const jwt = require('jsonwebtoken')
const port = 5000;
require('dotenv').config();

const app = express();
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(cors());
app.use(express.static('services'));
app.use(fileUpload());

const JWT_SECRET = 'alkfdkafdfkadlk@#$%#?{@#%$}djsdfhjds'

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vw2gd.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

client.connect(err => {
  const userCollection = client.db(process.env.DB_NAME).collection("users");
  const memesCollection = client.db(process.env.DB_NAME).collection("memes");
  const commentsCollection = client.db(process.env.DB_NAME).collection("comments");
  const likesCollection = client.db(process.env.DB_NAME).collection("likes");

  app.post('/api/register', (req, res) => {
    const registerData = req.body.registerData;
    const { username, password, password1 } = registerData
    const registerInfo = { username, password };
    const regex = /^(?=.*?[a-z])(?=.*?[0-9])(?=.*?[^\w\s]).{6,}$/

    if (!regex.test(password)) {
      res.send({
        status: "Password should contain six characters, at least one number and one special characters",
        code: 1100,
      })
    }
    else if (password !== password1) {
      res.send({
        status: "Password not matched",
        code: 1200,
      })
    } else {
      userCollection.find({ username: username })
        .toArray((err, document) => {
          if (document.length > 0) {
            res.send({
              status: "Username already exists",
              code: 1300,
            })
          } else {
            userCollection.insertOne(registerInfo)
              .then(result => {
                res.send(registerInfo)
              })
          }
        })
    }
  });

  app.post('/api/login', (req, res) => {
    const loginData = req.body.loginData;
    const { username, password } = loginData;
    console.log(username, password);
    userCollection.find({ username: username, password: password })
      .toArray((err, user) => {
        if (user.length <= 0) {
          res.send({
            status: "Invalid username or password",
            code: 401,
          })
        } else {
          const { _id, username } = user[0];
          const token = jwt.sign({
            id: _id,
            username: username,
          }, JWT_SECRET)
          res.send({
            status: 'Success fully logged in',
            code: 200,
            token: token
          })
        }
      })
  })


  app.post('/api/upload-image', (req, res) => {
    if (!req.files.file) {
      return res.status(400).json({
        status: 'error',
        error: 'req body cannot be empty',
      });
    }
    const file = req.files.file;
    const username = req.body.username;

    const filePath = `${__dirname}/memes/${file.name}`;
    file.mv(filePath, (err) => {

      const newImg = fs.readFileSync(filePath);
      const encImg = newImg.toString('base64');

      const image = {
        contentType: file.mimetype,
        size: file.size,
        img: Buffer.from(encImg, 'base64')
      };

      const memes = {
        username,
        image
      };

      memesCollection.insertOne(memes)
        .then(result => {
          return res.send(result.insertedCount > 0)
        });
    });
  });

  app.get('/api/memes', (req, res) => {
    memesCollection.find({})
      .toArray((err, document) => {
        res.send(document)
      })
  })

  app.post('/api/write-comment', (req, res) => {
    const commentData = req.body.commentData;
    commentsCollection.insertOne(commentData)
      .then(result => {
        if (result.insertedCount > 0) {
          return res.send({ status: 200 })
        }
      });
  })

  app.get('/api/comments/:_id', (req, res) => {
    const id = req.params._id;
    commentsCollection.find({ id: id })
      .toArray((err, comments) => {
        res.send(comments)
      })
  })

  app.post('/api/userLikes', (req, res) => {
    const userLikes = req.body.userLikes;
    const { username, _id } = userLikes;
    likesCollection.find({ username: username, id: _id })
      .toArray((err, likes) => {
        if (likes.length > 0) {
          res.send(likes[0])
        }
      })
  })

  app.post('/api/give-like', (req, res) => {
    const likeData = req.body.likeData;
    likesCollection.insertOne(likeData)
      .then(result => {
        if (result.insertedCount > 0) {
          return res.send({ status: 200 })
        }
      });
  })

  app.get('/api/likes/:_id', (req, res) => {
    const id = req.params._id;
    likesCollection.find({ id: id })
      .toArray((err, likes) => {
        res.send(likes)
      })
  })

  app.delete('/api/remove-like', (req, res) => {
    const likeData = req.body.likeData;
    const { username, id } = likeData;
    likesCollection.deleteOne({ username: username, id: id })
      .then(result => {
        if (result.deletedCount > 0) {
          return res.send({ status: 200 })
        }
      });
  })

  app.get('/', (req, res) => {
    res.send('Hello meme verse')
  })

  app.listen(process.env.PORT || port)

});
