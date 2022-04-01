var https = require('https');
var express = require('express');
var bodyParser = require('body-parser')
var http = require('http');
var hash = require('pbkdf2-password')()
var path = require('path');
var session = require('express-session');
var app = module.exports = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

var routerfile = require('./routerfile.js');

//both index.js and things.js should be in same directory

app.use(express.json() );       // to support JSON-encoded bodies
app.use(express.urlencoded({     // to support URL-encoded bodies
  extended: false
})); 


var inputfield = [
  {'inputIP':'8.8.8.8'}
  ]

var mapcoordinates = [
    {'lattitude':'error'},
  {'longitude':'error'}
]

// middleware

app.use(express.urlencoded({ extended: false }))
app.use(session({
  resave: false, // don't save session if unmodified
  saveUninitialized: false, // don't create session until something stored
  secret: 'shhhh, very secret'
}));

// Session-persisted message middleware

app.use(function(req, res, next){
  var err = req.session.error;
  var msg = req.session.success;
  delete req.session.error;
  delete req.session.success;
  res.locals.message = '';
  if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
  if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
  next();
});

// dummy database

var users = {
  tj: { name: 'tj' }
};

// when you create a user, generate a salt
// and hash the password ('foobar' is the pass here)

hash({ password: 'foobar' }, function (err, pass, salt, hash) {
  if (err) throw err;
  // store the salt & hash in the "db"
  users.tj.salt = salt;
  users.tj.hash = hash;
});


// Authenticate using our plain-object database of doom!

function authenticate(name, pass, fn) {
  if (!module.parent) console.log('authenticating %s:%s', name, pass);
  var user = users[name];
  // query the db for the given username
  if (!user) return fn(null, null)
  // apply the same algorithm to the POSTed password, applying
  // the hash against the pass / salt, if there is a match we
  // found the user
  hash({ password: pass, salt: user.salt }, function (err, pass, salt, hash) {
    if (err) return fn(err);
    if (hash === user.hash) return fn(null, user)
    fn(null, null)
  });
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

app.get('/', function(req, res){
  res.redirect('/login');
});

app.get('/logout', function(req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  req.session.destroy(function(){
    res.redirect('/');
  });
});

app.get('/login', function(req, res){
  res.render('login');
});

app.post('/login', function (req, res, next) {
  authenticate(req.body.username, req.body.password, function(err, user){
    if (err) return next(err)
    if (user) {
      // Regenerate session when signing in
      // to prevent fixation
      req.session.regenerate(function(){
        // Store the user's primary key
        // in the session store to be retrieved,
        // or in this case the entire user object
        req.session.user = user;
        req.session.success = 'Authenticated as ' + user.name
          + ' click to <a href="/logout">logout</a>. '
          + ' You may now access <a href="/restricted">/restricted</a>.';
        res.redirect('back');
      });
    } else {
      req.session.error = 'Authentication failed, please check your '
        + ' username and password.'
        + ' (use "tj" and "foobar")';
      res.redirect('/login');
    }
  });
});

app.get('/restricted', function(req, res){

  var html = '<br><form action="/IP/Confirmation" method="post"><label for="userIP"></label><br><input type="text" id="userIP" name="userIP"><input type="submit" value="Submit"><br></form>'

  res.send('Submit IP for Geolocation: ' + html);
});

app.post('/IP/Confirmation', function(req, res){

  console.log(req.body);
  var new_IP = req.body.userIP;

  var new_json = {'inputIP': new_IP};
  inputfield.push(new_json);
  res.send('IP: ' + new_IP + ' is added!<br> <a href=/IPresult>Click here to proceed.</a>');
});


app.get('/IPresult', function(req, res){

let url = 'https://ipfind.co/?ip='+inputfield[1].inputIP+'&auth=3addbd0d-9992-4fc7-8d92-0b4abc8fa2ad';
 
 https.get(url,(res) => {
     let body = "";
 
     res.on("data", (chunk) => {
         body += chunk;
     });
 
     res.on("end", () => {
         try {
             let json_data = JSON.parse(body);
             console.log(json_data);
             mapcoordinates.lattitude = json_data.latitude;
             mapcoordinates.longitude = json_data.longitude;
         } catch (error) {
             console.error(error.message);
         };
     });
 
 }).on("error", (error) => {
     console.error(error.message);
 });
 
   res.send('Click Here to see your map: <a href=/location>Location</a>');
 });
 
 
app.get('/location', function(req, res){

  res.render('geolocation', {
    latt: mapcoordinates.lattitude, 
    long: mapcoordinates.longitude
 });

   var html = "Lattitude: " + mapcoordinates.lattitude + ", Longitude: " + mapcoordinates.longitude

   res.send('Coordinates: ' + html);
});


app.listen(3000);