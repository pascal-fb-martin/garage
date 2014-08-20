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
//
// NAME
//
//   door - a module to hide the interface to GPIO pins for a door.
//
// SYNOPSYS
//
//   This module hides the interface to system-specific GPIO libraries.
//
//   This module allows porting the garage software to different
//   hardware interfaces. Only one hardware interface is supported at
//   a given time: you must have installed the right driver.
//
//   This specific implementation supports the "onoff" GPIO library.
//
//   This module depends on 'onoff' because that is one gpio interface
//   that is available on BeagleBone and Raspberry Pi (and probably others,
//   since it only relies on /sys/class/gpio).
//
//   This module do some tricks to workaround a Raspbian issue: access to
//   the gpio files is only granted after a short while, in the background.
//   The application needs to try again if it failed.
//
// DESCRIPTION
//
//   var Door = require('./door').Door;
//
//   var door = new Door (name, config, options);
//
//      Instanciate a new door, given the user-defined configuration and
//      command line options.
//
//      The config parameter must be a JavaScript object with the following
//      attributes:
//         name          The human readable identifier of the door.
//         control.pin   The name of the pin that controls that door.
//         control.on    The active value for the control (default: 1).
//         open.pin      The name of the pin that reports the "open" state.
//         open.on       The active value for the "open" state (default: 0).
//         closed.pin    The name of the pin that reports the "closed" state.
//         closed.on     The active value for the "closed" state (default: 0).
//
//   door.status ();
//
//      Return the current status of the door: "Closed", "Open", "Closing..",
//      "Opening..", "Moving..", "Unknown".
//
//      The "Moving.." and "Unknown" statuses are used when the actual state
//      of the door cannot be derived from the input and history of controls.
//
//   door.pulse ();
//
//      Trigger the control pulse to move the door.
//
//   door.reset ();
//
//      Force the control trigger off. This is used in case the program exits,
//      to avoid leaving the control active, which would block the door.
//
// --------------------------------------------------------------------------

function debugLog (text) {
   console.log ('[DEBUG] door: '+text);
}

function errorLog (text) {
   console.error ('[ERROR] door: '+text);
}

function cautionLog (text) {
   console.error ('[CAUTION] door: '+text);
}

try {
   var gpio = require('onoff').Gpio;
}
catch (err) {
   errorLog ('cannot access module onoff');
   var gpio = null;
}


// Raspbian issue: access to the gpio files is only granted
// after a short while, in the background. Need to try again until succesful.

function retry(item) {
   cautionLog ('Setting up pin '+item.pin+' failed, scheduling retry in 0.2 second');

   setTimeout (function() {
      cautionLog ('Retrying pin '+item.pin);
      try {
         item.gpio = new gpio(item.pin, 'out');
         item.ready = true; // No error was raised this time.
         if (item.dir == 'out') {
            item.gpio.writeSync(item.off);
         }
      }
      catch (err) {
         retry(item);
      }
   }, 200);
}

function configurePin (io, dir) {

   var item = new Object();

   item.pin = io.pin;
   item.dir = dir;
   if (dir == 'out') {
      item.on = 1;
      item.off = 0;
   } else {
      item.on = 0;
      item.off = 1;
   }
   if (io.on != undefined) {
      if (io.on == 'HIGH') {
         item.on = 1;
         item.off = 0;
      } else if (io.on == 'LOW') {
         item.on = 0;
         item.off = 1;
      }
   }
   item.status = false;
   item.value = item.off;

   if (gpio) {
      // Raspbian bug: access to the gpio files is only granted
      // after a short while, in the background.
      // Need to try again if it failed.
      item.ready = false;
      try {
         item.gpio = new gpio(item.pin, item.dir);
         item.ready = true; // No error was raised.
         if (item.dir == 'out') {
            item.gpio.writeSync(item.off);
         }
      }
      catch (err) {
         retry(item);
      }
   } else {
      item.ready = true;
   }
   return item;
}

function Door (config, options) {

   this.debug = false;
   if (options && options.debug) {
      this.debug = true;
      debugLog ('debug mode enabled');
   }

   if ((! gpio) || (! user.production)) {
      if (this.debug) debugLog ('using debug GPIO traces');
   }

   this.name    = config.name;
   this.control = configurePin (config.control, 'out');
   this.open    = configurePin (config.open, 'in');
   this.closed  = configurePin (config.closed, 'in');

   this.control.open = false;
   this.control.closed = false;
   this.control.pending = false;
}

Door.prototype.pulse = function () {

   this.control.open = this.open.status;
   this.control.closed = this.closed.status;
   this.control.pending = true;

   if (this.control.gpio) {
      this.control.gpio.writeSync(this.control.on);
      setTimeout (function() {
         this.control.gpio.writeSync(this.control.off);
      }, 2000);
   } else {
      if (this.debug) debugLog ('GPIO '+this.control.pin+' pulsed');
   }
}

function debounce(input) {

   if (input.gpio) {
      var value = imput.gpio.readSync();

      // Handle rebounce by requiring two identical consecutive values.
      if (value != input.value) {
         if (input.latest == value) {
            input.value = value;
            input.status = (input.value == input.on);
         }
         input.latest = value;
      }
   }
}

Door.prototype.refresh = function () {

   debounce (this.open);
   debounce (this.closed);

   // Detect when a pending control has been completed.
   if (this.control.pending) {
      if (this.open.status || this.closed.status) {
         if ((this.open.status != this.control.open) ||
             (this.closed.status != this.control.closed)) {
            this.controlPending = false;
         }
      }
   }
}

Door.prototype.status = function () {
   var status = "unknown";

   if (this.control.pending) {
      if (this.control.closed) {
         status = "opening..";
      } else if (this.control.open) {
         status = "closing..";
      } else {
         status = "moving..";
      }
   } else {
      if (this.open.status) {
        status = "open";
      } else if (this.closed.status) {
        status = "closed";
      }
   }

   return status;
}

exports.Door = Door;

