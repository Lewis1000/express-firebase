const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const express = require('express');
const app = express();

const config = require('./config');

const firebase = require('firebase');
firebase.initializeApp(config);

const isEmpty = (string) => {
    if (string.trim() === '') return true;
    else return false;
};

const isEmail = (email) => {
    const emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(emailRegEx)) return true;
    else return false;
};

const FBAuth = (req, res, next) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        return res.status(403).json({error: 'Something went wrong'});
    };
    admin.auth().verifyIdToken(idToken)
        .then(decodedToken => {
            req.user = decodedToken;
            return admin.firestore().collection('users').doc(decodedToken.uid).get();
        })
        .then(data => {
            req.user.name = data.data().name;
            return next();
        })
        .catch(err => {
            console.error(err);
            return res.status(403).json({error: 'Something went wrong'});
        });
};

app.get('/getusers', FBAuth, (req, res) => {
    admin.firestore().collection('users').get()
        .then(snapshot => {
            let users = [];
            snapshot.forEach(doc => {
                users.push({
                    name: doc.data().name,
                    admin: doc.data().verified
                });
            });
            return res.json(users);
        })
        .catch((err) => {
            console.error(err);
            return res.status(500).json({error: 'Something went wrong'});
        });
});

app.get('/getdata', FBAuth, (req, res) => {
    admin.firestore().collection('jobs').get()
        .then(snapshot => {
            let jobs = [];
            snapshot.forEach(doc => {
                jobs.push({
                    title: doc.data().title,
                    desc: doc.data().desc,
                    complete: doc.data().complete
                });
            });
            return res.json(jobs);
        })
        .catch((err) => {
            console.error(err);
            return res.status(500).json({error: 'Something went wrong'});
        });
});

app.post('/adddata', FBAuth, (req, res) => {
    const newData = {
        name: req.user.name,
        title: req.body.title,
        desc: req.body.desc,
        complete: req.body.desc
    };
    
    admin.firestore().collection('jobs').add(newData)
        .then((doc) => {
            return res.json({message: `Document ${doc.id} created successfully`});
        })
        .catch((err) => {
            console.error(err);
            return res.status(500).json({error: 'Something went wrong'});
        });
});

app.post('/signup', (req, res) => {
    const userData = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword
    };

    let errors = {};
    if (isEmpty(userData.email)) {
        errors.email = 'Must not be empty';
    } else if (!isEmail(userData.email)) {
        errors.email = 'Must be a valid email address';
    };
    if (isEmpty(userData.password)) errors.password = 'Must not be empty';
    if (userData.password !== userData.confirmPassword) errors.confirmPassword = 'Passwords must match';
    if (Object.keys(errors).length > 0) return res.status(400).json(errors);

    firebase.auth().createUserWithEmailAndPassword(userData.email, userData.password)
        .then((data) => {
            return data.user.getIdToken();
        })
        .then(token => {
            return res.status(201).json({token: token});
        })
        .catch((err) => {
            console.error(err);
            return res.status(500).json({error: 'Something went wrong'});
        });
});

app.post('/login', (req, res) => {
    const userData = {
        email: req.body.email,
        password: req.body.password
    };

    let errors = {};
    if (isEmpty(userData.email)) {
        errors.email = 'Must not be empty';
    } else if (!isEmail(userData.email)) {
        errors.email = 'Must be a valid email address';
    };
    if (isEmpty(userData.password)) errors.password = 'Must not be empty';
    if (Object.keys(errors).length > 0) return res.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(userData.email, userData.password)
        .then((data) => {
            return data.user.getIdToken();
        })
        .then(token => {
            return res.status(201).json({token: token});
        })
        .catch((err) => {
            console.error(err);
            return res.status(500).json({error: 'Something went wrong'});
        });
});

exports.api = functions.https.onRequest(app);