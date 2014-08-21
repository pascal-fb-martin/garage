//  Garage - a web server to control garage doors.
//
//  Copyright (C) 2014  Pascal Martin.
//
//  This program is free software; you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation; either version 2 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License along
//  with this program; if not, write to the Free Software Foundation, Inc.,
//  51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
//
// --------------------------------------------------------------------------

var os = require('os');
var fs = require('graceful-fs');
var express = require('express');
var staticpages = require('serve-static');

var path = require('./path');
var Door = require('./door').Door;
// var event = require('./event');


// ---------------------------------------------------------------------------
// COMMAND LINE OPTIONS

var options = new Object();

process.argv.forEach(function(val, index, array) {
    if (val == '--debug') {
        options.debug = true;
    }
    if (val == '--verbose') {
        options.verbose = true;
    }
});

var debugLog = function (text) {}

if (options.debug) {
    debugLog = function (text) {
        console.log ('[DEBUG] server: '+text);
    }
}
debugLog ('starting garage door controler');

var errorLog = function (text) {
    console.log ('[ERROR] server: '+text);
}


// ---------------------------------------------------------------------------
// PROGRAM CONFIGURATION

var config = fs.readFileSync(path.config());
try {
    config = JSON.parse(config);
    debugLog("User configuration parsed");
}
catch (err) {
    errorLog('There has been an error parsing the user config: '+err)
    process.exit(2);
} 

var garageDoors = new Object();

function declareDoors () {
   for (door in config.doors) {
      garageDoors[door] = new Door(config.doors[door], options);
   }
}
declareDoors();
   

// Now that the configuration is available, quickly declare
// a system exception catch-all, so that we can behave predictably
// before the software exits.
//
process.on('uncaughtException', function(err) {
    errorLog('Caught exception: ' + err.stack);
    for (door in config.doors) {
       try { garageDoors[door].reset() } catch (err) {}
    }
    setTimeout(function(){process.exit(1)}, 1000);
});

// For testing purpose only, do not uncomment otherwise!
//
//setTimeout(function(){ thisdoesnotexist(); }, 3000);

// ---------------------------------------------------------------------------
// THE WEB SERVER

var app = express();
app.use(staticpages(__dirname+'/public'));

if (options.verbose) {
   app.use(function(req, res, next){
      debugLog('received '+req.method+' '+req.url);
      next();
   });
}

// Routes

app.get('/pulse/:door', function(req, res){
    var door = req.params.door;
    debugLog ('pulse request for door '+door);
    try {
       garageDoors[door].pulse();
    }
    catch (err) {
       res.json(500, {status: 'error', msg:'invalid door '+door+' ('+err.stack+')'});
    }
    res.json({name:garageDoors[door].name,status:garageDoors[door].status()});
});

app.get('/status', function(req, res){
    var response = new Object();
    for (door in garageDoors) {
       response[door] = new Object();
       response[door].name = garageDoors[door].name;
       response[door].status = garageDoors[door].status();
    }
    res.json(response);
});

function missingHandler(req, res, next) {
    errorLog('404 Not found - '+req.url);
    res.json(404, { status: 'error', msg: 'Not found, sorry...' });
}

app.use(missingHandler);

app.listen(config.webport);
debugLog('Listening on port '+config.webport);


// Add the listener for periodic door status refresh.
//
setInterval(function(){
    for (door in garageDoors) {
       garageDoors[door].refresh();
    }
}, 500);

